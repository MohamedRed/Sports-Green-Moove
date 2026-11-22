import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [destination] = process.argv.slice(2);
assert(destination?.startsWith('/') && !existsSync(destination)); mkdirSync(destination, {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
const commit = '87082b10b44db59943089a21f82606f5a153be2b';
for (const [source, target] of [
  ['/private/tmp/sgm-notification-connected-services-recheck-20261023.json', 'services.json'],
  ['/private/tmp/sgm-notification-connected-build-20261023.log', 'native-build.txt'],
  ['/private/tmp/sgm-notification-connected-root-recheck-20261023.tap', 'root-tests.txt'],
]) copyFileSync(source, resolve(destination, target));
const service = JSON.parse(readFileSync(resolve(destination, 'services.json')));
assert.equal(service.completed, true); assert.equal(service.checks.length, 4); assert.equal(service.isolatedEnvironmentDestroyed, true);
const run = JSON.parse(execFileSync('gh', ['run', 'view', '40008087430', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs,url'], {encoding: 'utf8'}));
assert.equal(run.headSha, 'c3403d0c05acbab144e98995cddb08f915f5a36e'); assert.equal(run.status, 'completed');
assert.equal(run.conclusion, 'failure'); assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'success');
assert.equal(run.jobs.find(job => job.databaseId === 120601047686).conclusion, 'failure');
write('previous-native-run.json', run);
const log = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/jobs/120601047686/logs'], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
const excerpt = log.split('\n').filter(line => /Error on ZipFile unknown archive|could not connect to TCP port 5554|##\[error\]The process '\/usr\/bin\/sh' failed/.test(line));
assert(excerpt.some(line => line.includes('Error on ZipFile unknown archive')));
writeFileSync(resolve(destination, 'preparation-excerpt.txt'), excerpt.join('\n') + '\n');
const files = ['scripts/qa/local-notification-read-ui.mjs', 'scripts/qa/local-notification-read-services.mjs',
  'scripts/qa/run-notification-read-services.mjs', 'scripts/qa/notification-read-restart-evidence.mjs',
  'scripts/qa/local-android-session.mjs', 'scripts/qa/local-disposable-process-stop.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNotificationReadFlowTest.kt',
  'tests/notification-read-replay.test.mjs'];
const sources = {};
for (const file of files) {
  const bytes = execFileSync('git', ['show', `${commit}:${file}`]);
  const target = resolve(destination, 'source', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, bytes); sources[file] = createHash('sha256').update(bytes).digest('hex');
}
write('source-sha256.json', sources);
write('summary.json', {checkedAt: '2026-10-23', sourceCommit: commit,
  scope: 'authenticated-notification-service-checks-and-previous-device-preparation-failure-not-connected-ui',
  serviceChecksPassed: 4, protectedRecordCount: 167, rootTestsPassed: 1821, nativeRestartStagesCompiled: 2,
  connectedNativeUiAccepted: false, previousFullNativeJobPassed: true, previousNativeWorkflowPassed: false,
  previousFailedJobBeforeAppLaunch: true, downloadFailureRootCauseConfirmed: false,
  physicalPhoneAccepted: false, pushDeliveryAccepted: false, productionWrites: false, releaseComplete: false,
  firstFixtureAttempt: 'The fixture incorrectly expected a driver notice on booking request. That event is not implemented. The corrected fixture uses the existing real cancellation notice, without changing application behavior.',
  initialRootTestFailures: 'Sixteen source-contract assertions still pinned the old 36/38 matrix. Only current-run expectations were updated to 37/40; retained historical evidence remains unchanged.'});
const hashes = {};
function walk(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(file);
    else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
walk(); write('artifact-sha256.json', hashes);
console.log('Retained authenticated service checks and a distinct pre-app device failure.');
