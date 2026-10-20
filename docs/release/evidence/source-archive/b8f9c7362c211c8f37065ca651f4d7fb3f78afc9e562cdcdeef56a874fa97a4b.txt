import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedRideObservationFixture, verifyRideObservationFixture, verifyCompletedRideFixtureIsolation } from './local-ride-observation-fixture.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { prepareDisposableTestApks, usePreinstalledTestApks, installationGuardArguments, disposableTestRunner, disposableApkSourceFiles } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { readLocalMockPermission, setLocalMockPermission } from './local-mock-location-permission.mjs';

const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const execute = promisify(execFile), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 120_000 });
const shell = (...args) => execFileSync(adb, ['-s', serial, 'shell', ...args], { encoding: 'utf8', timeout: 30_000 });
mkdirSync(directory, { recursive: true });
let session, fixture, marker, transcript, failure, originalMockMode, completion, isolation, apkPreparation;
try {
  session = await seedLocalUiFixtures(); fixture = await seedRideObservationFixture();
  if (!usePreinstalledTestApks()) {
    const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
      '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'], { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  }
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  for (const permission of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'POST_NOTIFICATIONS'])
    shell('pm', 'grant', 'be.sportgreenmoove.app.local', `android.permission.${permission}`);
  originalMockMode = readLocalMockPermission(shell); setLocalMockPermission(shell, 'allow');
  ({ stdout: transcript } = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalRemoteRideStopFlowTest',
    '-e', 'liveRideId', fixture.rideSessionId, '-e', 'liveBookingId', fixture.bookingId, '-e', 'liveChildId', fixture.childId,
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { env: process.env, encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 }));
  transcript = transcript.replaceAll(session.password, '[REDACTED]'); console.log(transcript);
  writeFileSync(resolve(directory, 'LocalRemoteRideStopFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 1);
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'remote-ride-stop', runId: session.runId, password: session.password });
  marker = JSON.parse(readFileSync(resolve(directory, 'local-remote-ride-stop-device.json')));
  assert.equal(marker.scope, 'local-remote-completion-service-stop-not-physical-background-gps');
  assert.equal(marker.runId, session.runId); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  for (const key of ['rideSessionId', 'bookingId', 'childId']) assert.equal(marker[key], fixture[key]);
  for (const key of ['backgroundStopBeforeResume', 'driverStillSignedInAtStop', 'peerCompletionAcknowledged', 'mockModeRestored', 'firestoreClientTerminated'])
    assert.equal(marker[key], true);
  for (const key of ['physicalDevice', 'providerTrackingVerified', 'physicalBackgroundGpsVerified']) assert.equal(marker[key], false);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), ['ended', 'started'].map((id) => `local-native-startup-remote-${id}.png`));
  for (const [name, hash] of Object.entries(marker.screenshots)) assert.equal(createHash('sha256').update(readFileSync(resolve(directory, name))).digest('hex'), hash);
  completion = await verifyRideObservationFixture(fixture, marker);
} catch (error) {
  failure = error;
  if (session) {
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalRemoteRideStopFlowTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Read-only diagnostics unavailable; original failure preserved.'); }
    if (spawnSync(adb, ['-s', serial, 'shell', 'test', '-d', '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence'], { timeout: 15_000 }).status === 0) {
      try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
      catch { console.warn('Partial transfer unavailable; original failure preserved.'); }
    }
  }
}
try {
  if (fixture) {
    isolation = await verifyCompletedRideFixtureIsolation(fixture);
    writeFileSync(resolve(directory, 'remote-ride-stop-isolation.json'), JSON.stringify(isolation, null, 2) + '\n', { flag: 'wx' });
  }
} catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and baseline verification failed') : error; }
try { if (originalMockMode !== undefined) setLocalMockPermission(shell, originalMockMode); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and mock restoration failed') : error; }
try { await deleteApp(getApp()); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and admin shutdown failed') : error; }
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and package cleanup failed') : error; }
if (failure) throw failure;
const paths = [...disposableApkSourceFiles, 'scripts/qa/local-remote-ride-stop-ui.mjs', 'scripts/qa/run-local-remote-ride-stop-ui.mjs', 'scripts/qa/run-isolated-ride-ui.mjs',
  'scripts/qa/local-ride-observation-fixture.mjs', 'scripts/qa/isolated-ride-records.mjs', 'scripts/qa/local-mock-location-permission.mjs',
  ...['ActiveRideLocationService.kt', 'ActiveRideLocationLease.kt', 'ActiveRideLifecycle.kt', 'ActiveRideLifecycleWatch.kt', 'FirebaseAndroidNativeLocationStartup.kt']
    .map((name) => 'android/app/src/main/java/be/sportgreenmoove/app/services/' + name),
  ...['LocalRemoteRideStopFlowTest.kt', 'LocalRideCompletionPeer.kt', 'LocalMockLocation.kt', 'LocalMockLocationFeed.kt', 'LocalNativeStartupCapture.kt']
    .map((name) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name)];
writeFileSync(resolve(directory, 'remote-ride-stop-app-results.json'), JSON.stringify({ ...marker, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 1, steps: [{ id: 'remote-ride-stop', status: 'passed' }], nativeUiExecuted: true,
  primaryEvidencePhase: 'remote-ride-stop', transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
  cleanupMode: 'destroy-owned-local-environment', mockPermissionRestored: true, adminClientClosed: true, localPackagesRemoved: true, apkPreparation,
  completion, isolation, productionWrites: false, safetyAuditAccepted: false, storeReviewAccepted: false,
  sourceFiles: Object.fromEntries(paths.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
