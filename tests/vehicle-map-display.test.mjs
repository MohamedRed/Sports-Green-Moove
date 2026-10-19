import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { assertVehicleMapDisplay } from '../scripts/qa/vehicle-map-display-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function fixture(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-marker-validator-unit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const marker = { scope: 'local-authenticated-vehicle-marker-real-map-not-physical-gps', projectId: 'demo-sgm-local-qa',
    runId: 'a'.repeat(32), rideSessionId: 'unit-only-ride', parentUid: 'sgm-qa-parent', driverUid: 'sgm-qa-driver',
    sdkLoaded: true, parentSignedOut: true, firestoreClientTerminated: true, physicalDevice: false,
    providerTrackingVerified: false, childPositionsVerified: false, etaVerified: false, markerMovementPixels: 100,
    points: [{ lat: 50.75, lng: 4.55, capturedAt: 1000 }, { lat: 50.815, lng: 4.42, capturedAt: 2000 }], displays: [] };
  // Existing layout PNGs exercise file validation only, never SDK/render evidence.
  for (const [index, name] of ['narrow', 'stale'].entries()) {
    const bytes = readFileSync(new URL(`../docs/release/evidence/vehicle-map-layout-2026-10-19/local-native-startup-vehicle-map-${name}.png`, import.meta.url));
    const screenFile = `local-vehicle-map-${index ? 'moved' : 'first'}.png`;
    writeFileSync(resolve(directory, screenFile), bytes);
    marker.displays.push({ capture: 'native-display', screenFile, sha256: createHash('sha256').update(bytes).digest('hex'),
      samples: 2000, colorBins: 40, dominantFraction: 0.4, greenPixels: 60,
      mapBounds: { left: 10, top: 100, right: 700, bottom: 700 },
      markerBounds: { left: 100 + index * 100, top: 300, right: 140 + index * 100, bottom: 380 },
      departureBounds: { left: 30, top: 180, right: 70, bottom: 260 },
      arrivalBounds: { left: 600, top: 600, right: 640, bottom: 680 } });
  }
  return { marker, directory, verify: (value = marker) => assertVehicleMapDisplay(value, marker.runId, marker.rideSessionId, directory) };
}
test('synthetic validator inputs are checked without claiming a map test executed', (t) => {
  const f = fixture(t); assert.equal(f.verify().markerMovementVerified, true);
});
test('missing SDK loading, blank raster, wrong point, missing cleanup and stronger scope claims are rejected', (t) => {
  const f = fixture(t);
  for (const change of [
    (m) => { m.sdkLoaded = false; }, (m) => { m.parentSignedOut = false; },
    (m) => { m.physicalDevice = true; }, (m) => { m.providerTrackingVerified = true; },
    (m) => { m.childPositionsVerified = true; }, (m) => { m.etaVerified = true; },
    (m) => { m.points[1].lat = 91; }, (m) => { m.points[1].capturedAt = m.points[0].capturedAt; },
    (m) => { m.displays[0].colorBins = 2; }, (m) => { m.displays[0].dominantFraction = 0.95; },
    (m) => { m.displays[0].greenPixels = 0; }, (m) => { m.displays[0].sha256 = '0'.repeat(64); },
    (m) => { m.displays[1].screenFile = '../other.png'; },
  ]) { const m = structuredClone(f.marker); change(m); assert.throws(() => f.verify(m)); }
});
test('a scroll, camera shift, clipped pin or stationary pin cannot stand in for vehicle movement', (t) => {
  const f = fixture(t);
  for (const change of [
    (m) => { m.displays[1].mapBounds.top += 20; },
    (m) => { m.displays[1].departureBounds.left += 10; },
    (m) => { m.displays[1].arrivalBounds.top -= 10; },
    (m) => { m.displays[1].markerBounds.left = -1; },
    (m) => { m.displays[1].markerBounds = structuredClone(m.displays[0].markerBounds); },
    (m) => { m.markerMovementPixels = 999; },
  ]) { const m = structuredClone(f.marker); change(m); assert.throws(() => f.verify(m)); }
});
test('map execution is manually gated, isolated and compiled before the one disposable device attempt', () => {
  const workflow = read('.github/workflows/native-vehicle-map-ui.yml');
  assert(workflow.indexOf('Compile isolated app before') < workflow.indexOf('android-emulator-runner'));
  assert(workflow.includes('-PSGM_USE_FIREBASE_EMULATOR=true -PSGM_LOCAL_REAL_MAPS_UI=true'));
  assert(workflow.includes('SGM_TEST_PHONE_ADMIN_APPROVED: "true"'));
  assert(!workflow.includes('GOOGLE_MAPS_API_KEY:')); assert(!workflow.includes('SGM_REAL_MAPS_SERVER_KEY'));
  const dispatch = read('.github/workflows/native-ci.yml');
  assert(dispatch.includes("inputs.vehicle_map_ui && !inputs.real_maps_ui"));
  const worker = read('scripts/qa/local-vehicle-map-ui.mjs');
  assert(worker.includes("assertInstrumentationPassed(transcript, 1)"));
  assert(worker.indexOf("collect('vehicle-map')") < worker.indexOf('assertVehicleMapDisplay(marker'));
  assert(worker.includes('verifyReadOnlyRideFixtureIsolation(fixture)'));
  assert(worker.indexOf('if (failure) throw failure') < worker.indexOf("'vehicle-map-app-results.json'"));
  assert(read('scripts/qa/run-isolated-ride-ui.mjs').includes('isolatedEnvironmentDestroyed: true'));
});
test('native trial drives the actual app, separate authenticated peer and two native map captures', () => {
  const source = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalVehicleMapFlowTest.kt');
  for (const required of ['ActivityScenario.launch(MainActivity::class.java)', 'peer.point(lat, lng)',
    'runtime.firebase.getActiveRide()', 'captureVehicleMarkerDisplay(compose, device', 'FirebaseFirestore.getInstance().terminate()',
    'vehicleMarkerBounds(device)', 'point.capturedAt', 'assertFalse(ride.stale)']) assert(source.includes(required));
  assert(source.includes('assumeTrue(args.getString("vehicleMapApproved") != null)'));
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/VehicleMarkerDisplayEvidence.kt');
  assert(capture.includes('instrumentation.uiAutomation.takeScreenshot()'));
  assert(capture.includes('screen.getPixel(x, y)')); assert(capture.includes('region.contains(marker)'));
  assert(capture.includes('routeMarkerBounds(device, "Départ du trajet")'));
});
test('both route markers expose explicit accessible names, independently from their info-window titles', () => {
  const source = read('android/app/src/main/java/be/sportgreenmoove/app/ui/GoogleMapsRoutePreview.kt');
  for (const [title, description] of [['Départ', 'Départ du trajet'], ['Arrivée', 'Arrivée du trajet']]) {
    assert(source.includes(`title = "${title}", contentDescription = "${description}"`));
  }
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/VehicleMarkerDisplayEvidence.kt');
  assert(capture.includes('device.findObjects(By.desc(title))'));
  assert(!capture.includes('By.descContains(title)'));
  assert(capture.includes('check(markers.size == 1)'));
  assert(capture.includes('region.contains(departure) && region.contains(arrival)'));
  assert(capture.includes('.put("routeMarkerCounts", JSONObject()'));
});
test('the original accessible-anchor failure remains failed after the labels are corrected', () => {
  const root = new URL('../docs/release/evidence/vehicle-map-ui-anchor-failure-2026-10-19/', import.meta.url);
  const bytes = (file) => readFileSync(new URL(file, root));
  const run = JSON.parse(bytes('run.json'));
  assert.equal(run.databaseId, 39319579304);
  assert.equal(run.headSha, '17960e930e5a3cf89270fe52bddd1a6fdefc6171');
  assert.equal(run.conclusion, 'failure');
  const transcript = bytes('replay/LocalVehicleMapFlowTest-instrumentation.txt').toString();
  assert(transcript.includes('A single actual route anchor is required'));
  assert(transcript.includes('Tests run: 1,  Failures: 1'));
  assert.equal(JSON.parse(bytes('replay/local-vehicle-map-failure.json')).phase, 'first-point');
  assert.equal(JSON.parse(bytes('disposable-installations-activated.json')).installationsBlocked, true);
  const cleanup = JSON.parse(bytes('disposable-store-restore.json'));
  assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, true);
  assert.deepEqual(cleanup.installAdmin, { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true });
  const before = bytes('GoogleMapsRoutePreview-before.kt').toString();
  assert(before.includes('Marker(state = MarkerState(position = start), title = "Départ")'));
  for (const file of ['replay/local-vehicle-map-device.json', 'replay/vehicle-map-app-results.json', 'replay/vehicle-map-results.json'])
    assert.equal(existsSync(new URL(file, root)), false);
  for (const [file, hash] of Object.entries(JSON.parse(bytes('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash, file);
});
