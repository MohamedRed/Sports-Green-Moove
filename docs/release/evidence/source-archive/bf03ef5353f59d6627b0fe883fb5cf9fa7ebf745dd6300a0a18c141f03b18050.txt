import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { seedRideObservationFixture, verifyRideObservationFixture, cleanupRideObservationFixture } from './local-ride-observation-fixture.mjs';
import { prepareDisposableTestApks, usePreinstalledTestApks, installationGuardArguments, disposableTestRunner, disposableApkSourceFiles } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';

const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const execute = promisify(execFile);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 20 * 60_000 });
const directory = process.env.SGM_LOCAL_UI_OUTPUT;
mkdirSync(directory, { recursive: true });
let session, fixture, failure, marker, stored, transcript, apkPreparation;
try {
  session = await seedLocalUiFixtures();
  fixture = await seedRideObservationFixture();
  if (!usePreinstalledTestApks()) {
    const build = await execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest', '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2'],
      { env: process.env, cwd: root, timeout: 20 * 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(build.stdout); process.stderr.write(build.stderr);
  }
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  ({ stdout: transcript } = await execute(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    ...installationGuardArguments(), '-e', 'class', 'be.sportgreenmoove.app.ui.LocalRideObservationFlowTest',
    '-e', 'liveRideId', fixture.rideSessionId, '-e', 'liveRideBookingId', fixture.bookingId, '-e', 'liveRideChildId', fixture.childId,
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { env: process.env, encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 }));
  transcript = transcript.replaceAll(session.password, '[REDACTED]');
  writeFileSync(resolve(directory, 'LocalRideObservationFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  console.log(transcript); assertInstrumentationPassed(transcript, 1);
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'ride-observation', runId: session.runId, password: session.password });
  marker = JSON.parse(readFileSync(resolve(directory, 'local-ride-observation-device.json')));
  assert.equal(marker.scope, 'local-ride-live-sdk-not-physical-gps'); assert.equal(marker.projectId, 'demo-sgm-local-qa');
  assert.equal(marker.runId, session.runId); assert(marker.staleWaitElapsedMs > 80_000 && marker.staleWaitElapsedMs < 120_000);
  assert.equal(marker.parentUid, 'sgm-qa-parent'); assert.equal(marker.driverUid, 'sgm-qa-driver');
  assert.equal(marker.parentSignedOut, true); assert.equal(marker.physicalDevice, false);
  assert.equal(marker.providerTrackingVerified, false); assert.equal(marker.mapMovementVerified, false);
  assert.deepEqual(marker.operations, { writeLocationBatch: 2, markPickup: 1, markDropoff: 1, endRide: 1 });
  const expected = ['fresh', 'fresh-landscape', 'stale', 'recovered', 'pickup', 'resumed', 'ended', 'history'].map((id) => `local-ride-observation-${id}.png`);
  assert.deepEqual(Object.keys(marker.screenshots).sort(), expected.sort());
  for (const [name, hash] of Object.entries(marker.screenshots)) {
    const bytes = readFileSync(resolve(directory, name)); assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16) > bytes.readUInt32BE(20), name.includes('landscape'), 'Capture orientation must match the tested view');
  }
  stored = await verifyRideObservationFixture(fixture, marker);
} catch (error) {
  failure = error;
  if (session) {
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'LocalRideObservationFlowTest', password: session.password, runId: session.runId }); }
    catch { console.warn('Read-only process diagnostics unavailable; original failure preserved.'); }
    const remote = '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence';
    if (spawnSync(adb, ['-s', serial, 'shell', 'test', '-d', remote], { timeout: 15_000 }).status === 0) {
      try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password }); }
      catch { console.warn('Partial capture transfer unavailable; original failure preserved.'); }
    }
  }
}
try {
  if (fixture) await cleanupRideObservationFixture(fixture);
} catch (error) { failure = failure ? new AggregateError([failure, error], 'Ride observation replay and cleanup failed') : error; }
try { await deleteApp(getApp()); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Ride observation and admin shutdown failed') : error; }
try { resetDisposableLocalApps(adb, serial); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Ride observation and package cleanup failed') : error; }
if (failure) throw failure;
const paths = [...disposableApkSourceFiles, 'scripts/qa/run-local-ride-observation-ui.mjs',
  'scripts/qa/local-ride-observation-ui.mjs', 'scripts/qa/local-ride-observation-fixture.mjs',
  'functions/src/callables/rides.ts', 'functions/src/lib/activeRideLookup.ts', 'functions/src/lib/clientTrips.ts',
  ...['data/RideObservation.kt', 'services/FirebaseAndroidRideObservationGateway.kt', 'services/RideObservationWire.kt',
    'ui/ActiveRideObservationState.kt', 'ui/ActiveRideObservationEffect.kt', 'ui/AppDataState.kt', 'ui/SportsGreenMooveApp.kt',
    'services/RideObservationGateway.kt', 'services/FirebaseAndroidRuntime.kt', 'services/FirebaseAndroidRideMappers.kt',
    'ui/MobileRoleSelectionEffect.kt', 'domain/RideObservationAge.kt', 'ui/RideMonitorScreen.kt', 'ui/TripsScreen.kt'].map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/' + file),
  ...['LocalRideObservationPeer.kt', 'LocalRideObservationFlowTest.kt', 'LocalUiCapture.kt'].map((file) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file)];
writeFileSync(resolve(directory, 'ride-observation-results.json'), JSON.stringify({
  scope: 'local-ride-live-sdk-not-physical-gps', projectId: 'demo-sgm-local-qa', runId: session.runId, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 1, steps: [{ id: 'ride-observation-ui', status: 'passed' }],
  screenshots: marker.screenshots, staleWaitElapsedMs: marker.staleWaitElapsedMs, stored,
  transcriptSha256: createHash('sha256').update(transcript).digest('hex'), primaryEvidencePhase: 'ride-observation',
  fixture: Object.fromEntries(['tripId', 'bookingId', 'rideSessionId', 'childId'].map((key) => [key, fixture[key]])),
  isolatedFixtureCleanupVerified: true, adminClientClosed: true, localPackagesRemoved: true, apkPreparation,
  nativeUiExecuted: true, storeReviewAccepted: false, safetyAuditAccepted: false, realNetworkLossVerified: false,
  physicalDevice: false, productionWrites: false, mapMovementVerified: false, providerTrackingVerified: false,
  sourceFiles: Object.fromEntries(paths.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
