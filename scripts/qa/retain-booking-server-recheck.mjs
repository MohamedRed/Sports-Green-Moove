import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2];
assert(input?.startsWith('/'));
const dir = resolve(root, 'docs/release/evidence/booking-server-recheck-2026-11-05');
const baseCommit = '9ae6ea709da5f487a51a1542864d4cf4d0e8f4b1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = value => JSON.stringify(value, null, 2) + '\n';
const source = path => readFileSync(resolve(root, path));
const nativeScopes = ['ios', '.github/workflows/ios-mvp-verification.yml', 'scripts/check-ios-native-plan.sh',
  'scripts/check-ios-support-concurrency.sh', ':(glob)scripts/qa/check-ios-*', ':(glob)tests/fixtures/ios-*/**'];
execFileSync('git', ['diff', '--exit-code', baseCommit, '--', ...nativeScopes], {cwd: root});
const nativePaths = execFileSync('git', ['ls-files', '--', ...nativeScopes], {cwd: root, encoding: 'utf8'}).trim().split('\n').sort();
const nativeFiles = nativePaths.map(path => {
  const bytes = source(path); assert.equal(sha(bytes), sha(execFileSync('git', ['show', baseCommit + ':' + path], {cwd: root})));
  return {path, sha256: sha(bytes)};
});
const result = JSON.parse(readFileSync(resolve(input, 'sgm-booking-server-recheck-v2-20261105.json')));
assert.equal(result.passed, true); assert.equal(result.cases.length, 14);
assert(result.cases.every(row => row.status === 'passed' && row.mutationApplied));
assert.equal(result.projectId, 'demo-sgm-local-qa');
assert.equal(result.scope, 'controlled-local-booking-handler-not-phone-ui');
for (const [key, path] of [['bookingSourceSha256', 'functions/src/callables/bookings.ts'],
  ['requestSourceSha256', 'functions/src/callables/bookingRequests.ts'], ['intentSourceSha256', 'functions/src/domain/bookingIntent.ts']]) {
  assert.equal(result[key], sha(source(path)), path);
}
const closed = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001]);
const execution = readFileSync(resolve(input, 'sgm-booking-server-recheck-v2-20261105.log'), 'utf8');
assert(execution.includes('Booking consistency: 14/14 cases passed.'));
assert(execution.includes('Script exited successfully (code 0)'));
const tests = readFileSync(resolve(input, 'sgm-booking-server-recheck-java-tests-final-20261105.log'));
assert(tests.toString().includes('# pass 11')); assert(tests.toString().includes('# fail 0'));
mkdirSync(dir, {recursive: true}); assert(!existsSync(resolve(dir, 'summary.json')));
const records = [];
function record(name, bytes) {
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(dir, name), bytes, {flag: 'wx'}); records.push({file: name, sha256: sha(bytes)});
}
record('services.json', json(result));
record('java-environment-tests.txt', tests);
record('disposal.json', json({...closed, checkedAt: new Date().toISOString(), childProcessExitCode: 0}));
record('native-source-identity.json', json({baseCommit, aggregateSha256: sha(json(nativeFiles)), files: nativeFiles}));
const paths = ['scripts/qa/local-runtime.mjs', 'scripts/qa/local-java-environment.mjs', 'scripts/qa/local-runtime-disposal.mjs',
  'scripts/qa/local-emulator-lifecycle.mjs', 'scripts/qa/local-booking-consistency.mjs', 'scripts/qa/local-booking-application-race.mjs',
  'scripts/qa/run-local-booking-consistency.mjs', 'scripts/qa/local-egress-guard.mjs', 'tests/local-runtime-disposal.test.mjs',
  'tests/local-emulator-lifecycle.test.mjs', 'functions/src/callables/bookingRequests.ts', 'functions/src/callables/bookings.ts',
  'functions/src/domain/bookingIntent.ts', 'functions/src/lib/clientTrips.ts', '.github/workflows/web-integration-smoke.yml'];
const files = paths.map(path => {
  const bytes = source(path), hash = sha(bytes), archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(archive)), hash); return {path, sha256: hash};
});
record('source-sha256.json', json({files}));
record('portal-before.json', json({flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))}));
record('summary.json', json({checkedAt: '2026-11-05', sourceBaseCommit: baseCommit,
  scope: 'isolated-booking-handler-transactions-not-sdk-http-auth-phone-ui-or-real-payments',
  serviceCasesPassed: 14, environmentAndDisposalTestsPassed: 11, configuredJavaHomeUsedByChild: true,
  nativeSourceUnchanged: true, emulatorEndpointsClosed: true, earlierUnexecutedAttemptRetained: true,
  nativeSdkAccepted: false, nativeUiAccepted: false, realMapIntegrationAccepted: false,
  completeBookingFlowAccepted: false, physicalDeviceAccepted: false, releaseComplete: false,
  productionWrites: 0, externalProviderRequests: 0, realPayments: 0, newPhoneSessions: 0, newMedia: 0,
  records: [...records]}));
console.log('Retained fourteen isolated booking transactions, configured Java selection, verified local disposal and unchanged native source.');
