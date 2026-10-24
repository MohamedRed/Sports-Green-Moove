import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { XMLParser } from 'fast-xml-parser';

const text = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const service = (name) => text('android/app/src/main/java/be/sportgreenmoove/app/services/' + name + '.kt');
test('the original actual account-switch failure remains negative and source-bound', () => {
  const base = 'docs/release/evidence/ride-emergency-account-failure-2026-10-19/';
  const report = JSON.parse(text(base + 'results.json'));
  assert.equal(report.scope, 'failed-local-native-ride-account-switch-not-completed-flow');
  assert.equal(report.sourceCommit, '7dc5a99ab425858bad2f138d989437b2235528a7');
  assert.equal(report.nativeUiExecuted, true); assert.equal(report.journeyPassed, false);
  assert.equal(report.collectionScope, 'failure-cleanup-only'); assert.equal(report.primarySuccessMarker, false);
  for (const key of ['parentContactJourneyExecuted', 'driverResumedTrackingVerified', 'physicalDevice',
    'productionWrites', 'storeReviewAccepted', 'positionsDeliveredToParentProven']) assert.equal(report[key], false);
  const observation = JSON.parse(text(base + 'local-ride-emergency-parent-entry-tracking.json'));
  assert.deepEqual(report.observation, observation); assert.equal(observation.authenticatedUid, 'sgm-qa-parent');
  assert.equal(observation.expectedRunning, false); assert.equal(observation.observedRunning, true);
  assert(text(base + 'LocalRideFlowTest-instrumentation.txt').includes('Tests run: 1,  Failures: 1'));
  const cleanup = JSON.parse(text(base + 'disposable-store-restore.json'));
  assert.equal(cleanup.verified, true); assert.equal(cleanup.restored, true);
  assert.deepEqual(cleanup.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  for (const [file, hash] of Object.entries(JSON.parse(text(base + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + file, import.meta.url))).digest('hex'), hash, file);
});
test('native service and queued callbacks use immutable owner/session leases rather than the next account', () => {
  const source = service('ActiveRideLocationService');
  for (const guard of ['EXTRA_OWNER_UID', 'EXTRA_AUTH_REVISION', 'ownership.bind(', 'ownership.accepts(lease)',
    'callbackFor(lease: RideLocationLease)', 'auth.addAuthStateListener(authListener)', 'auth.removeAuthStateListener(authListener)',
    'ownership.ownerChanged()', 'scope.coroutineContext.cancelChildren()', 'stopLocationUpdates()', 'ownership.clear()', 'START_NOT_STICKY'])
    assert(source.includes(guard), guard);
  assert(!source.includes('return START_STICKY')); assert(!source.includes('?: ROLE_DRIVER'));
  assert(source.indexOf('if (!ownership.accepts(lease)) return\n        functions.getHttpsCallable') > 0);
  const lease = service('ActiveRideLocationLease');
  for (const guard of ['active === lease', 'currentUid() != ownerUid', 'currentRevision() != revision', 'lease.authRevision == currentRevision()'])
    assert(lease.includes(guard), guard);
});
test('sign-out invalidates pending starts and ends local sensing even for the same user logging in again', () => {
  const auth = service('FirebaseAndroidRuntime');
  assert(auth.includes('try { stopDeviceLocationForSignOut(context) } finally { auth.signOut() }'));
  const shutdown = service('NativeTrackingAuthorization');
  assert(shutdown.indexOf('NativeTrackingAuthorization.revoke()') < shutdown.indexOf('context.stopService'));
  assert(shutdown.includes('Radar.stopTracking()')); assert(!shutdown.includes('completeTrip(')); assert(!shutdown.includes('cancelTrip('));
  assert(service('FirebaseAndroidGateway').includes('nativeLocationStartup.start(rideSessionId, role)'));
  const gateway = service('FirebaseAndroidNativeLocationStartup');
  assert(gateway.indexOf('val authRevision =') < gateway.indexOf('getCurrentLocation('));
  assert.equal((gateway.match(/requireOwner\(\)/g) ?? []).length, 3);
  assert(gateway.includes('role.locationRole(), ownerUid, authRevision'));
});
test('explicit resume uses the permission gate for an owned existing ride without making parents track', () => {
  const action = text('android/app/src/main/java/be/sportgreenmoove/app/ui/ActiveRideResumeAction.kt');
  assert(action.indexOf('role !in setOf(AppRole.Driver, AppRole.Child)') < action.indexOf('permissionGate.runWhenReady'));
  assert(action.includes('currentUid() != ownerUid')); assert(action.includes('resumeOwnedRideTracking(expected.rideSessionId'));
  const resume = service('ActiveRideResume');
  for (const guard of ['role in session.roles', 'ride.rideSessionId == rideSessionId', 'ride.driverUserId == ownerUid',
    'firebase.writeNativeLocationFallback(rideSessionId, role)']) assert(resume.includes(guard), guard);
  assert(!resume.includes('firebase.startRide(')); assert(!resume.includes('radar.startTripTracking('));
  assert(text('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt').includes('onOpenRide = { launchActiveRideResume('));
  const shutdown = text('android/app/src/main/java/be/sportgreenmoove/app/ui/AppSessionShutdown.kt');
  assert(shutdown.includes('finally { providers.auth.signOut() }'));
});
test('all affected CI gates run ownership contracts and preserve independently checked tracking observations', () => {
  for (const file of ['backend-ci.yml', 'native-ci.yml', 'web-integration-smoke.yml'])
    assert(text('.github/workflows/' + file).includes('tests/ride-location-ownership.test.mjs'));
  const verifier = text('scripts/qa/verify-ride-emergency-ui.mjs');
  assert(verifier.includes("['driver-entry', 'driver-returned', 'parent-entry', 'parent-returned', 'driver-resumed']"));
  assert(verifier.includes('observation.authenticatedUid')); assert(verifier.includes("observation.observedRunning, role === 'driver'"));
  assert(verifier.includes('trackingPresenceNotGpsDelivery: true'));
});
test('the repair retains 18 original passing unit cases without claiming its app journey has run', () => {
  const base = 'docs/release/evidence/ride-location-ownership-repair-2026-10-19/';
  const report = JSON.parse(text(base + 'results.json'));
  assert.equal(report.scope, 'unit-verified-compiled-native-account-repair-not-replayed-ui');
  assert.equal(report.unitCaseCount, 18); assert.equal(report.unitFailures, 0);
  assert.equal(report.nativeTestApkCompiled, true); assert(text(base + 'native-build.txt').includes('BUILD SUCCESSFUL'));
  for (const key of ['nativeUiExecuted', 'activeRideJourneyPassed', 'providerStopExecuted', 'providerResumeExecuted',
    'physicalDevice', 'productionWrites', 'storeReviewAccepted']) assert.equal(report[key], false);
  const hashes = JSON.parse(text(base + 'artifact-sha256.json')), parser = new XMLParser({ ignoreAttributes: false });
  let count = 0;
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + base + file, import.meta.url))).digest('hex'), hash);
    if (file.endsWith('.xml')) {
      const suite = parser.parse(text(base + file)).testsuite;
      assert.equal(Number(suite['@_failures']), 0); assert.equal(Number(suite['@_errors']), 0); count += Number(suite['@_tests']);
    }
  }
  assert.equal(count, 18); assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
});
