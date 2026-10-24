import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, destination] = process.argv.slice(2);
assert(input?.startsWith('/') && destination?.startsWith('/') && !existsSync(destination));
mkdirSync(destination, {recursive: true});
const write = (file, row) => writeFileSync(resolve(destination, file), JSON.stringify(row, null, 2) + '\n');
const runId = '3e42efe016098e083ae64186229781b7';
const local = resolve(input, 'outputs/local-ui-evidence', runId), ordinary = resolve(input, 'outputs/store-review-screenshots');
for (const file of ['local-notification-read-before.json', 'local-notification-read-stop.json', 'local-notification-read-after.json',
  'notification-read-checkpoint.json', 'adb-pull-failure-cleanup.json']) copyFileSync(resolve(local, file), resolve(destination, file));
for (const file of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'disposable-store-restore.json'])
  copyFileSync(resolve(ordinary, file), resolve(destination, file));
copyFileSync(resolve(input, 'outputs/focused-safety-ui/full-matrix/host-shutdown/complete.json'), resolve(destination, 'host-observation.json'));
const run = JSON.parse(execFileSync('gh', ['run', 'view', '40014947968', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); write('native-run.json', run);
write('artifact-metadata.json', JSON.parse(execFileSync('gh', ['api',
  'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12529380747'], {encoding: 'utf8'})));
const log = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/120624500189/logs'],
  {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
const lines = log.split('\n'), start = lines.findIndex(line => line.includes('assert(phases.has(phase))'));
assert(start > 0);
writeFileSync(resolve(destination, 'collector-failure-excerpt.txt'), lines.slice(start - 2, start + 10).join('\n') + '\n');
for (const file of ['scripts/qa/collect-local-ui-evidence.mjs', 'scripts/qa/local-android-session.mjs',
  'scripts/qa/local-notification-read-ui.mjs', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNotificationReadFlowTest.kt']) {
  const target = resolve(destination, 'source', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, execFileSync('git', ['show', run.headSha + ':' + file]));
}
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: run.headSha, runId,
  scope: 'terminal-notification-native-attempt-with-failed-primary-collection-not-full-replay',
  ordinaryPassed: 157, ordinarySkipped: 52, ordinaryFailed: 1, notificationComponentCasesPassed: 4,
  notificationNativeStagesExecuted: 2, primaryCollectionAccepted: false, connectedStageAccepted: false,
  fullReplayAccepted: false, workflowPassed: false, newMediaAccepted: false,
  physicalPhoneAccepted: false, pushDeliveryAccepted: false, productionWrites: false, releaseComplete: false,
  collectorCause: 'The notification-read-restart phase was not registered in the collector allowlist. It rejects before issuing a primary copy.',
  ordinaryFailure: 'TripChangeFlowTest.agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement times out in Compose captureToImage/forceRedraw. Its underlying drawing cause is not established.',
  earlierAttempt: '87082b10 stopped at a whole-string matcher before reading. Explicit substring matching corrected that test; all four component cases execute and pass in this later run.'});
const hashes = {};
function walk(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(file);
    else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
walk(); write('artifact-sha256.json', hashes);
console.log('Retained terminal native failure without promoting cleanup copies or UI markers to full success.');
