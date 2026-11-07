import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {XMLParser} from 'fast-xml-parser';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {reviewDisplayFolder, validateReviewDisplayEvidence} from './review-display-evidence.mjs';

const [trial, previousTrial] = process.argv.slice(2), root = resolve(import.meta.dirname, '../..');
assert([trial, previousTrial].every(file => isAbsolute(file ?? '')));
assert(!readdirSync(tmpdir()).some(name => name.startsWith('sgm-local-runtime-')));
for (const pid of [51240, 86265, 15388]) assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
const endpoints = await assertLocalEndpointsClosed([5001, 8080, 9000, 9099, 45690, 45691, 5582, 5584, 5037]);
const base = resolve(root, reviewDisplayFolder); assert(!existsSync(base), 'Never replace original evidence');
mkdirSync(base, {recursive: true});
const json = file => JSON.parse(readFileSync(file));
const save = (file, value) => writeFileSync(resolve(base, file + '.json'), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const copy = (file, target = file) => cpSync(resolve(trial, file), resolve(base, target));
for (const file of ['before-instrumentation.txt', 'after-instrumentation-first.txt', 'after-line-bounds.txt',
  'layout-diagnostic.txt', 'layout-line-bounds-logcat.txt', 'before-proxy-test.log', 'after-proxy-tests.log',
  'after-build.log', 'line-bounds-build.log', 'installed-apks.json', 'received-ratings-large-text.png',
  'before-profile.kt.txt', 'before-test.kt.txt', 'before-restoration-proxy.mjs.txt', 'emulator.log']) copy(file);
const recoveryDirectory = resolve(trial, 'restoration-replay-first'); mkdirSync(resolve(base, 'recovery'));
const recovery = json(resolve(recoveryDirectory, 'session-restoration-results.json'));
for (const file of ['session-restoration-results.json', 'session-restoration-proxy.json', 'session-transport-observations.json',
  'adb-pull-session-restoration.json', 'LocalSessionRestorationTest-instrumentation.txt', ...Object.keys(recovery.screenshots)])
  cpSync(resolve(recoveryDirectory, file), resolve(base, 'recovery', file));
cpSync(resolve(previousTrial, 'prior-ordinary/outputs/store-review-screenshots/ordinary-results.json'), resolve(base, 'prior-ordinary-results.json'));
cpSync(resolve(previousTrial, 'prior-ordinary/outputs/store-review-screenshots/ordinary-instrumentation.txt'), resolve(base, 'prior-ordinary-instrumentation.txt'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = resolve(root, 'docs/release/evidence/source-archive');
const retain = (file, bytes, expected = digest(bytes)) => {
  assert.equal(digest(bytes), expected, file);
  const path = resolve(archive, expected + '.txt'); if (!existsSync(path)) writeFileSync(path, bytes, {flag: 'wx'});
  return expected;
};
for (const [file, expected] of Object.entries(recovery.sourceFiles)) retain(file, readFileSync(resolve(root, file)), expected);
const prefix = 'android/app/src/', app = 'main/java/be/sportgreenmoove/app/ui/', test = 'androidTest/java/be/sportgreenmoove/app/ui/';
const native = ['ProfileReceivedRatings.kt', 'ReceivedRatingLabels.kt'].map(file => prefix + app + file)
  .concat(['ReceivedRatingsFlowTest.kt', 'PendingReviewPaginationFlowTest.kt', 'LocalUiCapture.kt'].map(file => prefix + test + file));
save('native-sources', Object.fromEntries(native.map(file => [file, retain(file, readFileSync(resolve(root, file)))])));
const originals = [[prefix + app + 'ProfileReceivedRatings.kt', 'before-profile.kt.txt'],
  [prefix + test + 'ReceivedRatingsFlowTest.kt', 'before-test.kt.txt'], ['scripts/qa/session-restoration-fault-proxy.mjs', 'before-restoration-proxy.mjs.txt']];
save('original-sources', Object.fromEntries(originals.map(([file, original]) => [file, retain(file, readFileSync(resolve(base, original)))])));
const unitDirectory = resolve(root, 'android/app/build/test-results/testDebugUnitTest'), parser = new XMLParser({ignoreAttributes: false});
const units = {tests: 0, failures: 0, errors: 0, skipped: 0};
for (const file of readdirSync(unitDirectory).filter(name => name.endsWith('.xml'))) {
  const suite = parser.parse(readFileSync(resolve(unitDirectory, file), 'utf8')).testsuite;
  for (const key of Object.keys(units)) units[key] += Number(suite['@_' + key] ?? 0);
  if (/ReceivedRatingLabelsTest/.test(file)) cpSync(resolve(unitDirectory, file), resolve(base, file));
}
save('android-unit-counts', units);
save('summary', {scope: 'local-review-component-and-controlled-session-recovery-not-release', testedAt: recovery.testedAt,
  baselineCommit: '0b008ece43a485c2d27bb59df73c7b366990e5cf', implementationWasUncommittedAtBuild: true,
  failedAssertionWasFalsePositive: true, averageClippingDefectProven: false, syntheticMaximumCount: true,
  componentCasesPassed: 6, componentCasesFailed: 0, originalCaptureSha256: digest(readFileSync(resolve(base, 'received-ratings-large-text.png'))),
  physicalDeviceTested: false, realNetworkLossVerified: false, fullNativeGatePassed: false, productionDeployed: false,
  productionWrites: false, releaseComplete: false, realPayments: false, iosUiExecuted: false, mapRequests: 0});
save('disposal', {observedAt: new Date().toISOString(), ownedEmulatorProcessesAbsent: true, ownedAdbProcessAbsent: true,
  noLocalRuntimeDirectories: true, ports: endpoints.ports.map(port => ({port, available: true}))});
const hashes = {}, walk = directory => {for (const entry of readdirSync(resolve(base, directory), {withFileTypes: true})) {
  const file = directory ? directory + '/' + entry.name : entry.name;
  if (entry.isDirectory()) walk(file); else hashes[file] = digest(readFileSync(resolve(base, file)));
}}; walk(''); save('artifact-sha256', hashes);
console.log(JSON.stringify(validateReviewDisplayEvidence(root)));
