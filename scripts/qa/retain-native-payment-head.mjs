import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [main, focused, destination] = process.argv.slice(2);
assert([main, focused, destination].every(path => path?.startsWith('/')) && !existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (file, row) => writeFileSync(resolve(destination, file), JSON.stringify(row, null, 2) + '\n');
const runId = 'a2239c70ef0093e37721be72f9ef1c24', focusedId = '9e956b7b357ad4fd24e21c8403de0dbf';
const copy = (root, folder, file, name) => {
  const target = resolve(destination, name); mkdirSync(resolve(target, '..'), {recursive: true});
  copyFileSync(resolve(root, folder, file), target);
};
for (const [file, name] of [
  ['ordinary-results.json', 'ordinary-results.json'], ['native-suite-status.json', 'main-status.json'],
  ['disposable-store-restore.json', 'main-restoration.json']]) copy(main, 'outputs/store-review-screenshots', file, name);
for (const [file, name] of [
  ['adb-pull-trip-change-inputs.json', 'primary-copy.json'], ['adb-pull-failure-cleanup.json', 'cleanup-copy.json'],
  ['LocalAppFlowTest-LocalDriverFlowTest-LocalLandscapeLoginTest-LocalUiRegressionTest-SearchSessionFlowTest-SearchCriteriaFlowTest-instrumentation.txt', 'driver-batch.txt'],
  ['LocalTripChangeInputsFlowTest-instrumentation.txt', 'trip-inputs.txt'], ['local-trip-change-inputs-ui.json', 'trip-inputs.json']])
  copy(main, 'outputs/local-ui-evidence/' + runId, file, name);
copy(main, 'outputs/focused-safety-ui/full-matrix/host-shutdown', 'complete.json', 'main-host.json');
for (const [file, name] of [['LocalNativeTrackingStartupTest-instrumentation.txt', 'startup-instrumentation.txt'],
  ['local-native-startup-failure-tree.txt', 'startup-failure-tree.txt']])
  copy(focused, 'local-ui-evidence/' + focusedId, file, name);
copy(focused, 'focused-safety-ui/native-startup', 'disposable-device-restore.json', 'startup-restoration.json');
copy(focused, 'focused-safety-ui/native-startup/host-shutdown', 'complete.json', 'startup-host.json');
const gh = args => JSON.parse(execFileSync('gh', args, {encoding: 'utf8'}));
const run = gh(['run', 'view', '40023614141', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'databaseId,headSha,status,conclusion,jobs,url']);
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); write('native-run.json', run);
for (const [id, name] of [[12533545511, 'main-artifact.json'], [12532292087, 'startup-artifact.json']])
  write(name, gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/' + id]));
for (const file of ['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalDriverFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNativeTrackingStartupTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalMockLocationFeed.kt']) {
  const name = file.split('/').at(-1) + '.txt';
  writeFileSync(resolve(destination, name), execFileSync('git', ['show', run.headSha + ':' + file]));
}
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: run.headSha, runId, focusedRunId: focusedId,
  scope: 'terminal-native-primary-copy-and-fused-startup-failure-not-full-replay-or-release',
  ordinaryPassed: 159, ordinarySkipped: 52, ordinaryFailed: 0, driverBatchCasesPassed: 9,
  identityScopedApprovalExecuted: true, focusedCasesPassed: 9, focusedCasesFailed: 1,
  primaryCopyAccepted: false, cleanupCopySucceeded: true, cleanupFilesPulled: 100,
  restorationVerified: true, hostExitVerified: true, fullReplayAccepted: false, workflowPassed: false,
  startupCaseAccepted: false, rootCauseConfirmed: false, newMediaPublished: false,
  physicalTrackingAccepted: false, productionWrites: false, releaseComplete: false});
const files = readdirSync(destination).filter(file => file !== 'README.md');
write('artifact-sha256.json', Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
console.log('Retained terminal native outcomes without accepting either failed phase.');
