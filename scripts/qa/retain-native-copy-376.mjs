import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {copy376Folder, copy376Identity as identity, validateCopy376Evidence} from './native-copy-376-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), [zip, prerequisiteZip] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert([zip, prerequisiteZip].every(path => isAbsolute(path ?? '')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), original = readFileSync(zip);
assert.equal(original.length, identity.bytes); assert.equal(sha(original), identity.sha256);
const base = resolve(root, copy376Folder); assert(!existsSync(base)); mkdirSync(base);
const hashes = {}, members = [];
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
const local = 'outputs/local-ui-evidence/' + identity.runId + '/', device = 'outputs/store-review-screenshots/';
for (const [file, member] of [
  ['primary-copy.json', local + 'adb-pull-trip-change-inputs.json'], ['cleanup-copy.json', local + 'adb-pull-failure-cleanup.json'],
  ['sync-diagnostics.json', local + 'adb-sync-trip-change-inputs-diagnostics.json'],
  ['inputs-device.json', local + 'local-trip-change-inputs-ui.json'],
  ['inputs-instrumentation.txt', local + 'LocalTripChangeInputsFlowTest-instrumentation.txt'],
  ['consent-stage.json', local + 'trip-change-ui-stage.json'],
  ['consent-primary-copy.json', local + 'adb-pull-trip-change-parent-confirmation.json'],
  ['consent-instrumentation.txt', local + 'LocalTripChangeFlowTest-instrumentation.txt'],
  ['ordinary-results.json', device + 'ordinary-results.json'], ['suite-status.json', device + 'native-suite-status.json'],
  ['device-restoration.json', device + 'disposable-store-restore.json'],
  ['host-exit.json', 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json'],
  ['guest-process-log.txt', local + 'evidence-copy-trip-change-inputs-process-log.txt'],
  ['guest-memory.txt', local + 'evidence-copy-trip-change-inputs-guest-memory.txt'],
  ['host-disk-capacity.json', 'outputs/host-disk-capacity.json'],
]) {
  const bytes = execFileSync('unzip', ['-p', zip, member], {maxBuffer: 4 * 1024 * 1024}); record(file, bytes);
  members.push({file, member, bytes: bytes.length, sha256: sha(bytes)});
}
const names = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n');
const absentMembers = ['trip-change-inputs-ui-stage.json', 'results.json'].map(file => local + file);
for (const file of absentMembers) assert(!names.includes(file));
record('original-archive.json', {artifactId: identity.artifactId, bytes: original.length, sha256: sha(original), members, absentMembers});
record('artifact-metadata.json', JSON.parse(execFileSync('gh', ['api',
  'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/' + identity.artifactId], {encoding: 'utf8'})));
record('native-run.json', JSON.parse(execFileSync('gh', ['run', 'view', String(identity.workflowId), '--repo',
  'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'})));
const sources = {};
for (const path of ['scripts/qa/collect-local-ui-evidence.mjs', 'scripts/qa/adb-host-health.mjs', 'scripts/qa/adb-host-sockets.mjs',
  'scripts/qa/adb-sync-failure-diagnostics.mjs', 'scripts/qa/local-android-session.mjs', 'scripts/qa/local-trip-change-inputs-ui.mjs',
  'scripts/qa/local-trip-change-ui.mjs', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripChangeInputsFlowTest.kt']) {
  const bytes = execFileSync('git', ['show', identity.source + ':' + path], {cwd: root}), hash = sha(bytes);
  const target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'}); assert.equal(sha(readFileSync(target)), hash); sources[path] = hash;
}
record('source-sha256.json', sources);
record('summary.json', {checkedAt: '2026-11-06', sourceCommit: identity.source,
  scope: 'retained-verified-consent-stage-and-later-primary-copy-disconnect-not-full-replay',
  consentStageVerified: true, inputsDeviceCasePassed: true, transportDisconnectObserved: true, cleanupCopyPassed: true,
  primaryCopyPassed: false, inputsHostStageVerified: false, copyRootCauseConfirmed: false, daemonRestartProven: false,
  fullReplayAccepted: false, wholeNativeGateAccepted: false, physicalDeviceAccepted: false, newMedia: 0, releaseComplete: false});
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
execFileSync(process.execPath, [resolve(import.meta.dirname, 'retain-native-copy-376-prerequisite.mjs'), prerequisiteZip], {stdio: 'inherit'});
validateCopy376Evidence(root); console.log('Verified consent stage retained separately from incomplete input-stage copy and transport observations.');
