import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRideEmergencyDevice, rideEmergencyCaptures } from '../scripts/qa/ride-emergency-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const text = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function fixture() {
  const image = Buffer.alloc(24); image.write('89504e470d0a1a0a', 0, 'hex'); image.writeUInt32BE(1080, 16); image.writeUInt32BE(2400, 20);
  const hash = createHash('sha256').update(image).digest('hex'), runId = 'd'.repeat(32), ride = { rideSessionId: 'qa-ride', tripId: 'qa-trip' };
  const marker = { projectId: 'demo-sgm-local-qa', runId, scope: 'local-native-active-ride-emergency-not-physical',
    physicalDevice: false, productionWrites: false, driverResumedTracking: true, actors: ['driver', 'parent'].map((role) => ({ role, ownerUid: `sgm-qa-${role}`,
      ...ride, returnedToSameRide: true, passengerStatusesUnchanged: true, contactChosenThroughUi: true,
      foreignContactVisible: false, driverControlsAvailable: role === 'driver', contactSavedRevision: 1, contactRemovedRevision: 2,
      dialIntentCount: 1, directCallIntentCount: 0, dialerNumberMatched: true, dialerPackage: 'com.android.dialer' })),
    screenshots: Object.fromEntries(rideEmergencyCaptures.map((file) => [file, hash])) };
  const receipt = { projectId: marker.projectId, runId, scope: 'local-adb-file-sync-command-not-flow-verification',
    phase: 'ride-emergency', completed: true, status: 0, signal: null, errorCode: null };
  return { marker, receipt, runId, ride, image };
}
const validate = (f) => validateRideEmergencyDevice(f.marker, f.receipt, f.runId, f.ride, () => f.image);
test('typed unit fixtures require two ordered actors, the same ride and eight primary capture bindings', () => {
  const f = fixture(); validate(f); assert.equal(rideEmergencyCaptures.length, 8);
  assert.equal(new Set(rideEmergencyCaptures).size, 8);
});
test('a wrong account, ride, permissions, saved revision or dial result cannot pass', () => {
  for (const mutate of [
    (f) => { f.marker.actors.reverse(); }, (f) => { f.marker.actors.pop(); },
    (f) => { f.marker.actors[1].ownerUid = 'sgm-qa-driver'; }, (f) => { f.marker.actors[1].rideSessionId = 'other'; },
    (f) => { f.marker.actors[1].tripId = 'other'; }, (f) => { f.marker.actors[1].driverControlsAvailable = true; },
    (f) => { f.marker.actors[0].contactRemovedRevision = 1; }, (f) => { f.marker.actors[0].directCallIntentCount = 1; },
    (f) => { f.marker.actors[0].dialIntentCount = 0; }, (f) => { f.marker.actors[0].dialerNumberMatched = false; },
    (f) => { f.marker.actors[0].foreignContactVisible = true; }, (f) => { f.marker.actors[0].returnedToSameRide = false; },
    (f) => { f.marker.actors[0].passengerStatusesUnchanged = false; },
    (f) => { f.marker.actors[0].dialerPackage = 'be.sportgreenmoove.app.local'; },
    (f) => { f.ride.rideSessionId = ''; }, (f) => { delete f.ride.tripId; },
    (f) => { f.marker.driverResumedTracking = false; },
  ]) { const f = fixture(); mutate(f); assert.throws(() => validate(f)); }
});
test('backend, web smoke and native gates include the new typed ride-contact contracts', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml', 'native-ci.yml'])
    assert(text('.github/workflows/' + name).includes('tests/ride-emergency-evidence.test.mjs'));
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(text('.github/workflows/' + name).includes('npm run test:ride-emergency-fixture'));
});
test('a failed, foreign or cleanup-only copy cannot replace the primary ride transfer', () => {
  for (const patch of [{ phase: 'failure-cleanup' }, { phase: 'emergency-contact' }, { completed: false }, { status: 1 },
    { signal: 'SIGTERM' }, { errorCode: 'ETIMEDOUT' }, { runId: 'e'.repeat(32) }, { projectId: 'production' }]) {
    const f = fixture(); Object.assign(f.receipt, patch); assert.throws(() => validate(f));
  }
});
test('missing, changed, non-PNG or landscape captures remain invalid despite a passing marker', () => {
  for (const mutate of [(f) => { delete f.marker.screenshots[rideEmergencyCaptures[0]]; },
    (f) => { f.marker.screenshots[rideEmergencyCaptures[0]] = 'a'.repeat(64); },
    (f) => { f.image = Buffer.alloc(24); }, (f) => { f.image.writeUInt32BE(100, 20); }]) {
    const f = fixture(); mutate(f); assert.throws(() => validate(f));
  }
});
test('only UI actions choose/remove contacts and both actual dialers must return before marker emission', () => {
  const file = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRideEmergencyUi.kt', source = text(file);
  for (const guard of ['ro.kernel.qemu', 'providers.auth.currentSession()', 'initial.revision == 0L', 'otherPhone).assertDoesNotExist()',
    'click(SgmTestTags.EmergencyContact)', 'performTextReplacement(phone)', 'click("emergency.save")', 'click("emergency.remove")',
    'Intent.ACTION_DIAL', 'Intent.ACTION_CALL', 'numberMatched && dial.hits == 1 && direct.hits == 0',
    'device.currentPackageName == context.packageName', 'check(!file.exists())', 'unchangedRide(expected)',
    'assertTracking(role, "entry")', 'assertTracking(role, "returned")', 'observedRunning',
    'SgmTestTags.ActiveRidePickupAction).assertDoesNotExist()', 'SgmTestTags.ActiveRideEndAction).assertDoesNotExist()']) assert(source.includes(guard), guard);
  assert(!source.includes('saveEmergencyContact(')); assert(!source.includes('Intent.ACTION_CALL).addFlags'));
  assert(source.indexOf('assertTracking(role, "returned")') > source.indexOf('click(SgmTestTags.BackAction)'));
  const scenario = text('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalRideFlowTest.kt');
  assert(scenario.indexOf('contacts.verify("driver"') < scenario.indexOf('contacts.verify("parent"'));
  assert(scenario.indexOf('writeRideEmergencyEvidence(') < scenario.indexOf('repeat(2) { index ->'));
  assert(scenario.indexOf('contacts.assertTracking("driver", "resumed")') < scenario.indexOf('writeRideEmergencyEvidence('));
  for (const guard of ['LocalRideFlowTest', 'collectEvidence(\'ride-emergency\')', 'await verifyLocalRideUi(evidenceDir, session.runId)'])
    assert(text('scripts/qa/local-android-session.mjs').includes(guard), guard);
});
test('independent persisted verification cannot pass without four own-only operations and completed original ride checks', () => {
  const verify = text('scripts/qa/verify-ride-emergency-ui.mjs');
  for (const guard of ['validateRideEmergencyDevice', 'assertInstrumentationPassed', 'contacts.size, 2', 'operations.size, 4',
    "record.get('contact'), null", "record.get('revision'), 2", "doc.get('actorUserId') === uid", "flag: 'wx'",
    'emergencyContactRecordSchema.parse(record.data())', 'operation.get(\'createdAt\') instanceof Timestamp',
    "['actorUserId', 'contactId', 'createdAt', 'fingerprint', 'revision']", 'record.get(\'createdAt\').isEqual',
    'physicalDevice: false', 'storeReviewAccepted: false']) assert(verify.includes(guard), guard);
  const ride = text('scripts/qa/verify-local-ride-ui.mjs');
  for (const guard of ["ride.status, 'completed'", 'audit.size, 4', "ratings.docs[0].data().score, 5", 'verifyRideEmergencyUi(directory, runId'])
    assert(ride.includes(guard), guard);
  assert(ride.indexOf('ratings.size, 1') < ride.indexOf('await verifyRideEmergencyUi('));
});
test('actual stored-state verification and successful compilation remain explicitly separate from native journey execution', () => {
  const base = 'docs/release/evidence/ride-emergency-prepared-2026-10-19/';
  const services = JSON.parse(text(base + 'storage-services.json')), build = JSON.parse(text(base + 'build-checks.json'));
  assert.equal(services.scope, 'actual-contact-storage-verifier-not-native-ride-or-dialer');
  assert.equal(services.runId, '6a0febf2621f36b3e424eab8fb4fc14d'); assert.equal(services.actualActors, 2);
  assert.equal(services.privateOperationsVerified, 4); assert.equal(services.checks.length, 5);
  assert(services.checks.every((item) => item.status === 'passed'));
  assert.equal(build.scope, 'compiled-active-ride-contact-test-not-executed-native-flow');
  assert.equal(build.nativeTestApkCompiled, true); assert.match(build.testApkSha256, /^[a-f0-9]{64}$/);
  assert(text(base + 'native-build.txt').includes('BUILD SUCCESSFUL'));
  for (const report of [services, build]) {
    for (const key of ['nativeUiExecuted', 'dialerOpened', 'physicalDevice', 'productionWrites']) assert.equal(report[key], false);
    assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  }
  assert.equal(services.rideJourneyExecuted, false); assert.equal(services.providerRequests, 0);
  for (const [file, hash] of Object.entries(JSON.parse(text(base + 'artifact-sha256.json')))) {
    const bytes = readFileSync(new URL('../' + base + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
});
