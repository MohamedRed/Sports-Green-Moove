import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, destination] = process.argv.slice(2);
assert(input?.startsWith('/') && destination?.startsWith('/') && !existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (file, row) => writeFileSync(resolve(destination, file), JSON.stringify(row, null, 2) + '\n');
const runId = 'b5503afe3db7991c77ee96a925156ae7', local = resolve(input, 'outputs/local-ui-evidence', runId);
const row = JSON.parse(readFileSync(resolve(local, 'notification-read-ui-stage.json'))); assert.equal(row.completed, true);
for (const file of ['notification-read-ui-stage.json', 'notification-read-records.json', 'notification-read-checkpoint.json',
  'local-notification-read-before.json', 'local-notification-read-stop.json', 'local-notification-read-after.json',
  'adb-pull-notification-read-restart.json',
  'LocalNotificationReadFlowTest#readSelectedNotificationAndSwitchAccounts-instrumentation.txt',
  'LocalNotificationReadFlowTest#reopenReadNotificationAfterProcessDeath-instrumentation.txt',
  'LocalAppFlowTest-LocalDriverFlowTest-LocalLandscapeLoginTest-LocalUiRegressionTest-SearchSessionFlowTest-SearchCriteriaFlowTest-instrumentation.txt',
  ...row.captureFiles]) copyFileSync(resolve(local, file), resolve(destination, file));
for (const file of ['ordinary-results.json', 'native-suite-status.json', 'disposable-store-restore.json'])
  copyFileSync(resolve(input, 'outputs/store-review-screenshots', file), resolve(destination, file));
copyFileSync(resolve(input, 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json'), resolve(destination, 'host-observation.json'));
const run = JSON.parse(execFileSync('gh', ['run', 'view', '40019171668', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); write('native-run.json', run);
write('artifact-metadata.json', JSON.parse(execFileSync('gh', ['api',
  'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12529898848'], {encoding: 'utf8'})));
for (const file of ['scripts/qa/local-notification-read-ui.mjs', 'scripts/qa/collect-local-ui-evidence.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalDriverFlowTest.kt']) {
  const target = resolve(destination, 'source', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, execFileSync('git', ['show', run.headSha + ':' + file]));
}
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: run.headSha, runId,
  scope: 'completed-connected-notification-native-restart-with-later-driver-case-failure-not-full-replay',
  notificationStageAccepted: true, nativeCasesPassed: 2, protectedRecords: 176, primaryCollectionAccepted: true,
  ordinaryPassed: 158, ordinarySkipped: 52, ordinaryFailed: 0, notificationComponentCasesPassed: 4,
  fullReplayAccepted: false, workflowPassed: false, driverApprovalRegressionCorrected: false,
  exactPostFailureApprovalStateRetained: false, physicalPhoneAccepted: false, pushDeliveryAccepted: false,
  newMediaPublished: false, productionWrites: false, releaseComplete: false,
  laterFailure: 'The next nine-case batch times out at LocalDriverFlowTest line 51. Its global approval count expects two, while the earlier notification fixture adds an approved booking. The later identity-scoped correction is separately compiled; the exact post-failure booking state is not retained, so this report does not establish that this is the sole failure cause.'});
const hashes = {};
function walk(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(file); else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
walk(); write('artifact-sha256.json', hashes);
console.log('Retained completed notification restart and the separately failed subsequent native batch.');
