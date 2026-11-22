import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { auth, document } from './local-flow-client.mjs';
import { seedRideObservationFixture, verifyReadOnlyRideFixtureIsolation } from './local-ride-observation-fixture.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { installDisposableTestApks, installationGuardArguments, disposableTestRunner } from './install-disposable-test-apks.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { collectNativeProcessFailure } from './native-process-failure-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertVehicleMapDisplay } from './vehicle-map-display-evidence.mjs';

assert.equal(process.env.SGM_VEHICLE_MAP_UI, 'approved-sdk-map');
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const adb = resolve(process.env.ANDROID_HOME, 'platform-tools/adb'), directory = process.env.SGM_LOCAL_UI_OUTPUT;
mkdirSync(directory, { recursive: true });
let session, fixture, marker, isolation, transcript, failure, primaryCollected = false;
const redact = (value) => String(value).replaceAll(session?.password ?? '\0', '[REDACTED]')
  .replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env: process.env, encoding: 'utf8',
  timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 });
const collect = (phase) => collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase,
  runId: session.runId, password: session.password });
try {
  session = await seedLocalUiFixtures(); fixture = await seedRideObservationFixture();
  resetDisposableLocalApps(adb, serial); installDisposableTestApks({ adb, serial, android, run });
  run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
  transcript = run(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    ...installationGuardArguments(), '-e', 'vehicleMapApproved', session.runId, '-e', 'liveRideId', fixture.rideSessionId,
    '-e', 'class', 'be.sportgreenmoove.app.ui.LocalVehicleMapFlowTest', `be.sportgreenmoove.app.local.test/${disposableTestRunner}`]);
  transcript = redact(transcript); console.log(transcript);
  writeFileSync(resolve(directory, 'LocalVehicleMapFlowTest-instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 1);
  collect('vehicle-map'); primaryCollected = true;
  marker = JSON.parse(readFileSync(resolve(directory, 'local-vehicle-map-device.json')));
  assertVehicleMapDisplay(marker, session.runId, fixture.rideSessionId, directory);
  const final = marker.points[1], live = (await getDatabase().ref(`liveTrips/${fixture.rideSessionId}/vehicle`).get()).val();
  for (const key of ['lat', 'lng', 'capturedAt']) assert.equal(live[key], final[key]);
  assert.equal(live.source, 'nativeFallback'); assert.equal(live.userId, 'sgm-qa-driver');
  assert.equal((await document('rideSessions', fixture.rideSessionId)).status, 'active');
  assert.equal((await document('bookings', fixture.bookingId)).status, 'approved');
  assert.deepEqual((await auth.getUser('sgm-qa-driver')).customClaims, fixture.claims);
  isolation = await verifyReadOnlyRideFixtureIsolation(fixture);
} catch (error) {
  failure = new Error(redact(error.stack ?? error));
  if (session) {
    if (error.stdout && !transcript) writeFileSync(resolve(directory, 'failed-instrumentation.txt'), redact(error.stdout), { flag: 'wx' });
    try { collectNativeProcessFailure({ adb, serial, directory, label: 'vehicle-map', password: session.password, runId: session.runId }); }
    catch { console.warn('Map process diagnostics unavailable; original failure is unchanged.'); }
    if (!primaryCollected) try { collect('failure-cleanup'); }
    catch { console.warn('Partial map capture transfer unavailable; original failure is unchanged.'); }
  }
}
for (const cleanup of [() => deleteApp(getApp()), () => resetDisposableLocalApps(adb, serial)]) {
  try { await cleanup(); }
  catch (error) { failure = failure ? new AggregateError([failure, new Error(redact(error.message))], 'Map trial and cleanup failed') : error; }
}
if (failure) throw failure;
const files = ['scripts/qa/local-vehicle-map-ui.mjs', 'scripts/qa/run-local-vehicle-map-ui.mjs',
  'scripts/qa/run-isolated-ride-ui.mjs', 'scripts/qa/vehicle-map-display-evidence.mjs',
  ...['LocalVehicleMapFlowTest.kt', 'VehicleMarkerDisplayEvidence.kt', 'VehicleMapFailureEvidence.kt', 'LocalRideObservationPeer.kt']
    .map((name) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name),
  ...['GoogleMapsRoutePreview.kt', 'VehicleMapMarker.kt', 'FitRouteMapCamera.kt']
    .map((name) => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + name),
  'functions/src/domain/vehicleMapPoint.ts', 'functions/src/lib/clientTrips.ts'];
writeFileSync(resolve(directory, 'vehicle-map-app-results.json'), JSON.stringify({ ...marker, testedAt: new Date().toISOString(),
  testCount: 1, nativeCaseCount: 1, nativeUiExecuted: true, primaryEvidencePhase: 'vehicle-map',
  transcriptSha256: createHash('sha256').update(transcript).digest('hex'), fixtureIsolation: isolation,
  cleanupMode: 'destroy-owned-local-environment', adminClientClosed: true, localPackagesRemoved: true,
  productionWrites: false, safetyAuditAccepted: false, storeReviewAccepted: false,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
