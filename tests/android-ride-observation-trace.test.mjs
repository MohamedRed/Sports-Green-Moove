import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(file, 'utf8');
const services = 'android/app/src/main/java/be/sportgreenmoove/app/services/';
test('ride tracing is opt-in and limited to isolated debug builds', () => {
  const gradle = read('android/app/build.gradle.kts');
  assert(gradle.includes('check(!localRideTrace || useFirebaseEmulator)'));
  assert(gradle.includes('buildConfigField("Boolean", "SGM_LOCAL_RIDE_TRACE", "false")'));
  assert(gradle.indexOf('getByName("debug")') < gradle.indexOf('localRideTrace.toString()'));
  const factory = read(services + 'LocalRideObservationTrace.kt');
  assert(factory.includes('BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && BuildConfig.SGM_LOCAL_RIDE_TRACE'));
  assert.doesNotMatch(factory, /setLogLevel|enableLogging|FirebaseAuth|FirebaseFunctions/);
});
test('the diagnostic schema accepts no user strings or payloads', () => {
  const trace = read(services + 'RideObservationTrace.kt');
  assert(trace.includes('fun record(event: RideObservationEvent, connected: Boolean? = null)'));
  assert.doesNotMatch(trace, /rideSessionId|uid|latitude|longitude|payload|Throwable|Exception\.message|password|token/i);
});
test('the optional connection listener is detached and cannot trigger a refresh or a fallback', () => {
  const gateway = read(services + 'FirebaseAndroidRideObservationGateway.kt');
  assert(gateway.includes('if (trace != null) database.getReference(".info/connected") else null'));
  const connection = gateway.slice(gateway.indexOf('val connectionListener'), gateway.indexOf('connectionReference?.addValueEventListener'));
  assert.doesNotMatch(connection, /trySend|\.call\(|close\(/);
  assert(gateway.includes('connectionReference?.removeEventListener(connectionListener)'));
  assert(gateway.includes('}.conflate().mapLatest'));
  assert.doesNotMatch(gateway, /retryWhen|delay\(|while\s*\(|goOffline|goOnline/);
  for (const outcome of ['FetchCompleted', 'FetchCancelled', 'FetchFailed'])
    assert(gateway.includes('trace?.record(RideObservationEvent.' + outcome + ')'));
});
