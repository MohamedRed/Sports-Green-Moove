import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {nativeClockStartupScope, validateNativeClockStartupReport} from '../scripts/qa/native-clock-startup-evidence.mjs';
import {validateNativeStartupReport} from '../scripts/qa/native-startup-retained-evidence.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const service = name => read('android/app/src/main/java/be/sportgreenmoove/app/services/' + name + '.kt');
test('native payloads order captures with server-anchored elapsed time, keeping device wall time only as provenance', () => {
  const payload = service('NativeLocationPayloads');
  assert(payload.includes('clock.capturedAt(location.elapsedRealtimeNanos, SystemClock.elapsedRealtimeNanos())'));
  assert(payload.includes('capturedAtMs = capturedAt')); assert(!payload.includes('capturedAtMs = location.time'));
  assert(payload.includes('"deviceCapturedAt" to location.time')); assert(payload.includes('"captureClock" to "serverElapsedRealtime"'));
  assert(!service('NativeCaptureClock').includes('System.currentTimeMillis'));
  assert(!service('NativeCaptureClock').includes('android.'));
});
test('startup requires the selected active ride and a trusted response before sampling and acknowledging GPS', () => {
  const startup = service('FirebaseAndroidNativeLocationStartup');
  for (const fragment of ['getHttpsCallable("getActiveRide")', 'getCurrentLocation', 'requireNativeLocationAcknowledgement',
    'clock.observe', 'startForegroundService']) assert(startup.includes(fragment), fragment);
  assert(startup.indexOf('getHttpsCallable("getActiveRide")') < startup.indexOf('getCurrentLocation'));
  assert(startup.includes('call(mapOf("rideSessionId" to rideSessionId))'));
  assert(startup.includes('ride?.get("rideSessionId") == rideSessionId'));
  assert(!startup.includes('ride["status"] == "active"'));
  assert(startup.indexOf('requireOwner()', startup.indexOf('val received =')) < startup.indexOf('getCurrentLocation'));
  assert(startup.indexOf('requireOwner()', startup.indexOf('requireNativeLocationAcknowledgement')) < startup.indexOf('clock.observe'));
  assert(startup.indexOf('clock.observe') < startup.indexOf('startForegroundService'));
});
test('the service clock is transient, lease-bound and cannot absorb a late response for another ride or account', () => {
  const source = service('ActiveRideLocationService');
  assert(source.includes('@Volatile private var captureClock'));
  assert(source.includes('ownership.accepts(lease) && captureClock === clock'));
  assert(source.includes('captureClock = clock')); assert(source.includes('startLocationUpdates(lease)'));
  assert(source.includes('clock.observe(result.data, started, SystemClock.elapsedRealtimeNanos())'));
  assert.equal((source.match(/captureClock = null/g) ?? []).length, 2);
  assert(source.indexOf('captureClock = clock') < source.indexOf('startLocationUpdates(lease)'));
  assert(source.includes('clock.snapshot().receivedElapsedNanos > SystemClock.elapsedRealtimeNanos()'));
  assert(source.includes('lease.ownerUid == ownerUid && lease.rideSessionId == rideSessionId'));
  assert(source.includes('clock.anchors.map { it.serverTimeMs }.toLongArray()'));
  assert(source.includes('return START_NOT_STICKY')); assert(!source.includes('SharedPreferences'));
  const actions = read('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveRideActions.kt');
  assert(actions.indexOf('setError(null)') < actions.indexOf('providers.startTrackedRide'));
});
test('the native control reader uses the configured database instance with a bounded wait', () => {
  const trial = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalNativeTrackingStartupTest.kt');
  assert(trial.includes('AndroidRuntime.liveDatabase().getReference'));
  assert(trial.includes('withTimeout(30_000)'));
  assert(!trial.includes('FirebaseDatabase.getInstance()'));
  assert(service('FirebaseAndroidRuntime').includes('internal fun liveDatabase(): FirebaseDatabase = FirebaseAndroidEmulatorConfig.database()'));
});

function versionTwo() {
  const report = JSON.parse(read('docs/release/evidence/native-startup-pass-2026-10-19/native-startup-results.json'));
  report.scope = nativeClockStartupScope; report.clockProtocolVersion = 2;
  for (const field of ['duplicateStarted', 'invalidPreventedStart', 'duplicateResumed']) delete report[field];
  for (const field of ['retainedStarted', 'futureUploadRejected', 'wallAheadStarted', 'wallBehindResumed']) report[field] = true;
  const time = report.capturedAt;
  const point = {rideSessionId: report.rideSessionId, userId: report.driverUid, role: 'driver',
    lat: 50.7, lng: 4.6, capturedAt: time, uploadedAt: time + 1_000, source: 'nativeFallback'};
  report.points = {retainedStart: point,
    wallAhead: {...point, capturedAt: time + 10_000, uploadedAt: time + 11_000, deviceCapturedAt: time + 86_400_000, captureClock: 'serverElapsedRealtime'},
    wallBehind: {...point, capturedAt: time + 20_000, uploadedAt: time + 21_000, deviceCapturedAt: time - 86_400_000, captureClock: 'serverElapsedRealtime'}};
  for (const name of ['first', 'duplicate']) report.receipts[name].serverTimeMs = time + 1_000;
  report.receipts.future = {written: 0, ignored: 1, serverTimeMs: time + 2_000,
    receipts: [{rideSessionId: report.rideSessionId, role: 'driver', status: 'invalid', capturedAt: time + 86_400_000}]};
  report.screenshots['local-native-startup-ahead.png'] = report.screenshots['local-native-startup-invalid.png'];
  delete report.screenshots['local-native-startup-invalid.png'];
  return report;
}
test('the new clock protocol has an explicit scope and cannot inherit historical invalid-start claims', () => {
  validateNativeClockStartupReport(versionTwo()); validateNativeStartupReport(versionTwo());
  const legacy = JSON.parse(read('docs/release/evidence/native-startup-pass-2026-10-19/native-startup-results.json'));
  validateNativeStartupReport(legacy);
  assert.throws(() => validateNativeClockStartupReport(legacy));
});
for (const mutate of [
  row => { row.clockProtocolVersion = 1; },
  row => { row.scope = 'unknown-clock-protocol'; },
  row => { row.scope = 'local-fused-mock-startup-not-physical-gps'; },
  row => { row.invalidPreventedStart = true; },
  row => { row.points.retainedStart.captureClock = 'serverElapsedRealtime'; },
  row => { row.points.wallBehind.deviceCapturedAt = row.points.wallBehind.capturedAt; },
  row => { row.receipts.future.receipts[0].status = 'retained'; },
  row => { row.physicalDevice = true; },
]) test('a synthetic schema fixture rejects an unsupported native-clock claim: ' + mutate, () => {
  const report = versionTwo(); mutate(report); assert.throws(() => validateNativeStartupReport(report));
});
