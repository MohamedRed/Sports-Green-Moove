import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, resolve} from 'node:path';
import {retainChatNetworkRecheck} from './retain-chat-network-replay.mjs';
import {network959Archives, network959Folder, network959Identity, validateNetwork959Evidence} from './native-network-959-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), [mainZip, focusedZip, input] = process.argv.slice(2);
for (const path of [mainZip, focusedZip, input]) assert(isAbsolute(path ?? ''));
const base = resolve(root, network959Folder); assert(!existsSync(base));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [kind, zip] of [['main', mainZip], ['focused', focusedZip]]) {
  const bytes = readFileSync(zip), expected = network959Archives[kind];
  assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256);
}
const member = (zip, path) => execFileSync('unzip', ['-p', zip, path], {maxBuffer: 8 * 1024 * 1024});
const local = 'local-ui-evidence/' + network959Identity.runId + '/', device = 'focused-safety-ui/chat-network-recovery/';
const focusedMembers = [
  ...['chat-network-recovery-results.json', 'chat-network-recovery-app-results.json', 'local-chat-network-ui.json',
    'LocalChatNetworkFlowTest-instrumentation.txt', 'adb-pull-network-recovery.json'].map(file => [local + file, file]),
  ...['disposable-device-setup.json', 'disposable-device-restore.json', 'chat-network-recovery-suite-status.json'].map(file => [device + file, file]),
];
const staging = mkdtempSync(resolve(tmpdir(), 'sgm-network-959-stage-'));
try {
  for (const [path] of focusedMembers) {
    mkdirSync(dirname(resolve(staging, path)), {recursive: true}); writeFileSync(resolve(staging, path), member(focusedZip, path), {flag: 'wx'});
  }
  retainChatNetworkRecheck(staging, network959Identity);
} finally {rmSync(staging, {recursive: true, force: true});}
const focusBase = resolve(root, network959Identity.folder), focusHashesPath = resolve(focusBase, 'artifact-sha256.json');
const focusHashes = JSON.parse(readFileSync(focusHashesPath)), focusedReceipt = [];
for (const [path, file] of [...focusedMembers, [device + 'host-shutdown/complete.json', 'host-shutdown.json'],
  [device + 'network-readiness/outcome.json', 'wifi-readiness.json']]) {
  const bytes = member(focusedZip, path);
  if (!existsSync(resolve(focusBase, file))) writeFileSync(resolve(focusBase, file), bytes, {flag: 'wx'});
  assert.deepEqual(readFileSync(resolve(focusBase, file)), bytes); focusHashes[file] = sha(bytes);
  focusedReceipt.push({member: path, destination: network959Identity.folder, file, bytes: bytes.length, sha256: sha(bytes)});
}
writeFileSync(focusHashesPath, JSON.stringify(focusHashes, null, 2) + '\n');
mkdirSync(base); const hashes = {}, mainReceipt = [];
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
const mainLocal = 'outputs/local-ui-evidence/b7e679d38e2c679372c9190d7248ebe2/', mainDevice = 'outputs/store-review-screenshots/';
for (const [path, file] of [
  [mainLocal + 'local-chat-network-ui.json', 'main-ui.json'],
  [mainLocal + 'LocalChatNetworkFlowTest-instrumentation.txt', 'main-instrumentation.txt'],
  [mainLocal + 'chat-network-validation-before.json', 'main-validation-before.json'],
  [mainLocal + 'chat-network-validation-after.json', 'main-validation-after.json'],
  [mainLocal + 'chat-subscriptions-before.json', 'main-subscriptions.json'],
  [mainLocal + 'adb-pull-failure-cleanup.json', 'main-evidence-copy.json'],
  [mainDevice + 'network-bootstrap/chat-subscriptions-before.json', 'main-bootstrap-subscriptions.json'],
  [mainDevice + 'disposable-store-restore.json', 'main-device-restore.json'],
  [mainDevice + 'native-suite-status.json', 'main-suite-status.json'],
  [mainDevice + 'ordinary-results.json', 'main-ordinary-results.json'],
  ['outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json', 'main-host-shutdown.json'],
]) {
  const bytes = member(mainZip, path); record(file, bytes);
  mainReceipt.push({member: path, destination: network959Folder, file, bytes: bytes.length, sha256: sha(bytes)});
}
record('main-archive.json', {...network959Archives.main, artifactId: network959Archives.main.id, members: mainReceipt});
record('focused-archive.json', {...network959Archives.focused, artifactId: network959Archives.focused.id, members: focusedReceipt});
record('focused-wifi-readiness.json', readFileSync(resolve(focusBase, 'wifi-readiness.json')));
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/MohamedRed/Sports-Green-Moove/${path}`], {encoding: 'utf8'}));
record('main-job.json', api('actions/jobs/128006497424'));
for (const [file, path] of [
  ['regression-before.txt', 'sgm-matrix-prerequisite-baseline-corrected-20261106.log'],
  ['regression-after.txt', 'sgm-matrix-prerequisite-after-corrected-20261106.log'],
  ['initial-harness.txt', 'sgm-matrix-prerequisite-baseline-20261106.log'],
  ['callback-health.json', 'sgm-376-callback-health-20261106.json'],
]) record(file, readFileSync(resolve(input, path)));
const failureLog = readFileSync(resolve(input, 'sgm-376-release-readiness-failure-20261106.log'), 'utf8');
assert(failureLog.includes('SGM_STRIPE_CONNECT_REFRESH_URL callback host') && failureLog.includes('could not be reached (timeout)'));
record('callback-timeout.json', {sourceCommit: '376addb0d2dcc98a0c145247afb40d80dc8bfd34', runId: 42261168620,
  jobId: 128041172906, check: 'Validate Stripe production readiness', failureKind: 'timeout',
  observedAt: '2026-11-06T17:25:59.1309209Z', callbackKind: 'refresh', readinessAccepted: false, causeConfirmed: false});
const sources = {baseline: {}, candidate: {}};
for (const kind of ['baseline', 'candidate']) for (const path of ['scripts/run-android-ui-tests-and-collect-screenshots.sh',
  'scripts/run-focused-android-ui.sh', 'scripts/qa/wait-disposable-wifi.mjs', 'scripts/qa/disposable-wifi-readiness.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalInitialNetworkObservation.kt',
  '.github/workflows/native-ci.yml', 'tests/full-matrix-network-prerequisite.test.mjs']) {
  const bytes = kind === 'baseline' && !path.startsWith('tests/full-matrix-') ?
    execFileSync('git', ['show', `376addb0d2dcc98a0c145247afb40d80dc8bfd34:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'}); assert.equal(sha(readFileSync(target)), hash); sources[kind][path] = hash;
}
assert.equal(sources.baseline['tests/full-matrix-network-prerequisite.test.mjs'], sources.candidate['tests/full-matrix-network-prerequisite.test.mjs']);
record('source-sha256.json', sources);
record('summary.json', {checkedAt: '2026-11-06', sourceCommit: network959Identity.head,
  focusedRecoveryAccepted: true, mainFailedPhase: 'network-preparation', mainRadioCutExecuted: false,
  wholeNativeGateAccepted: false, underlyingDnsCauseConfirmed: false, dnsRepaired: false,
  passivePreflightAddedToFullMatrix: true, physicalDeviceAccepted: false, providerReadinessAccepted: false,
  newMedia: 0, releaseComplete: false,
  initialHarnessCorrection: 'The existing shell wrapper exits 1, not the inner sentinel status; the corrected baseline preserves exact source and command-order checks.'});
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
validateNetwork959Evidence(root); console.log('Exact paired recovery/preparation evidence retained, including independent disposal; no DNS repair or whole-release acceptance.');
