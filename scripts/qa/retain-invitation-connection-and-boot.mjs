import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const [input] = process.argv.slice(2); assert.equal(process.argv.length, 3); assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), evidence = resolve(root, 'docs/release/evidence');
const sha = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path));
const write = (base, file, value) => {
  const path = resolve(base, file); mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
};
const archive = sources => {
  for (const [path, hash] of Object.entries(sources)) {
    const bytes = readFileSync(resolve(root, path)); assert.equal(sha(bytes), hash, path);
    const destination = resolve(evidence, 'source-archive', hash + '.txt');
    if (existsSync(destination)) assert.deepEqual(readFileSync(destination), bytes);
    else writeFileSync(destination, bytes, {flag: 'wx'});
  }
};
const fingerprint = base => {
  const hashes = {};
  for (const item of readdirSync(base, {recursive: true, withFileTypes: true}).filter(row => row.isFile())) {
    const path = resolve(item.parentPath, item.name); hashes[path.slice(base.length + 1)] = sha(readFileSync(path));
  }
  write(base, 'artifact-sha256.json', hashes);
};
const phone = resolve(evidence, 'invitation-phone-connection-2026-10-30');
const boot = resolve(evidence, 'native-capacity-e64555e-2026-10-30');
assert(!existsSync(phone) && !existsSync(boot)); mkdirSync(phone); mkdirSync(boot);
for (const file of ['observations.json', 'connection-blocked-records.json', 'disposal.json'])
  copyFileSync(resolve(input, 'invitation-physical-browser-runtime', file), resolve(phone, file), 1);
for (const file of ['127-loopback-refused', 'localhost-refused']) for (const suffix of ['.jpg', '-phone.png', '.json'])
  copyFileSync(resolve(input, 'invitation-physical-phone-images', file + suffix), resolve(phone, file + suffix), 1);
for (const file of ['uninstall-observation.txt', 'phone-disposal.json'])
  copyFileSync(resolve(input, 'invitation-physical-phone-images', file), resolve(phone, file), 1);
const observed = json(resolve(phone, 'observations.json'));
const sources = {...observed.sourceFiles};
for (const path of ['scripts/qa/browserstack-local-policy.mjs', 'scripts/qa/scoped-browserstack-local.mjs',
  'scripts/qa/start-scoped-browserstack-local.mjs', 'scripts/qa/run-scoped-browserstack-local.mjs',
  'scripts/qa/private-credential-form.mjs', 'scripts/qa/private-credential-form-page.mjs',
  'scripts/qa/observe-invitation-connection-block.mjs']) sources[path] = sha(readFileSync(resolve(root, path)));
archive(sources); write(phone, 'source-files.json', sources);
const records = json(resolve(phone, 'connection-blocked-records.json'));
assert.equal(records.childAccountExists, false); assert.equal(records.redemptionCount, 0);
const runtime = json(resolve(phone, 'disposal.json')); assert.equal(runtime.failed, false);
assert.equal(runtime.isolatedEnvironmentDestroyed, true); assert.equal(runtime.emulatorEndpoints.closed, true);
write(phone, 'summary.json', {scope: 'physical-android-browser-connection-refused-before-signup-not-product-or-root-cause-proof',
  runId: observed.runId, testedAt: '2026-10-30', sourceCommit: 'e64555e7d8c2d23b34bc05e2e952625a6c44ca05',
  apkSha256: '3837331ce85b2cddadc39145f6ae2713f504ac590114a7c97d89763a3adc6642',
  browserFormReached: false, childAccountCreated: false, parentApprovalProven: false,
  nativeShareToSignupProven: false, productionWrites: false, realPayments: false, mapRequests: 0,
  browserLoopbackRequestsRefused: 2, loopbackPageRespondedOnHost: true, toolbarLocalEnabledObserved: true,
  resolveAllUrlsEnabled: false, approvedExtraLoopbackPort: 4185, browserAliasEnabled: false,
  helperExitedWithoutRequestedStop: true, helperExitCode: 0, helperGroupExitVerified: true,
  helperExitTimeKnown: false, helperConnectionContinuityProven: false,
  helperDirectoryAbsent: !existsSync('/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-Cdth0E'),
  publicCapturesAdded: 0, videoRecorded: false, independentPackageAbsenceProven: false, releaseComplete: false});
const gh = args => JSON.parse(execFileSync('gh', args, {encoding: 'utf8', timeout: 60_000}));
write(boot, 'pr-checks.json', gh(['pr', 'view', '1', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'headRefOid,statusCheckRollup']));
write(boot, 'run.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/runs/41120151150']));
write(boot, 'job.json', gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/124284519409']));
const log = readFileSync(resolve(input, 'e64555e-native-failure.private.log'), 'utf8');
const fatal = log.split('\n').filter(line => /FATAL.*Not enough space to create userdata partition|Timeout waiting for emulator to boot|emulator -port 5554 -avd test/.test(line)).join('\n');
assert(fatal.includes('Available: 6926.72 MB')); assert(fatal.includes('need 7372.80 MB'));
assert(!log.includes('Test run finished:')); write(boot, 'boot-failure-excerpt.txt', fatal + '\n');
write(boot, 'summary.json', {scope: 'terminal-native-emulator-capacity-failure-before-app-tests',
  sourceCommit: 'e64555e7d8c2d23b34bc05e2e952625a6c44ca05', runId: 41120151150, jobId: 124284519409,
  availableMb: 6926.72, requiredMb: 7372.80, emulatorVersion: '37.2.13.0', emulatorStarted: false,
  appUiExecuted: false, acceptedTestCases: 0, originalLogSha256: sha(Buffer.from(log)),
  capacityCorrectionExecutedOnHostedRunner: false, earlierTransferRootCauseProven: false, releaseComplete: false});
fingerprint(phone); fingerprint(boot);
console.log('Retained the incomplete phone connection and terminal pre-test native capacity failure separately.');
