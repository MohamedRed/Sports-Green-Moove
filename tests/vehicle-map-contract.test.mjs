import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRetainedVehicleMapServices, validateVehicleMapLayout, validateVehicleMapServices } from '../scripts/qa/vehicle-map-evidence.mjs';
import { content } from '../partner-portal/content.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const text = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
test('authenticated coordinate evidence proves its actual seven groups and no renderer or physical success', () => {
  const report = validateRetainedVehicleMapServices(root, 'docs/release/evidence/vehicle-map-services-2026-10-19/services.json');
  for (const patch of [{ mapSdkVerified: true }, { physicalDevice: true }, { checks: [] },
    { isolatedEnvironmentDestroyed: false }, { providerRequests: 1 }])
    assert.throws(() => validateVehicleMapServices({ ...report, ...patch }));
});
test('layout evidence comes from two actual component cases, not a native map renderer', () => {
  validateVehicleMapLayout(root, 'docs/release/evidence/vehicle-map-layout-2026-10-19/layout-results.json');
});
test('the original invalid-coordinate acceptance remains failed and is not a passed trial', () => {
  const prefix = 'docs/release/evidence/vehicle-map-invalid-coordinate-2026-10-19/';
  assert.match(text(prefix + 'services-failed.txt'), /Missing expected rejection: writeLocationBatch must reject with INVALID_ARGUMENT/);
  assert.match(text(prefix + 'locationBatch-before.ts.txt'), /lat: z.number\(\),/);
  assert.match(text('functions/src/domain/locationBatch.ts'), /lat: z.number\(\).min\(-90\).max\(90\)/);
});
test('geographic validity protects native batches, other providers and the coordinate projection', () => {
  assert(text('functions/src/domain/liveLocationOrder.ts').includes('!hasGeographicCoordinates(incoming)'));
  assert(text('functions/src/domain/liveLocationOrder.ts').includes('hasGeographicCoordinates(current)'));
  const project = text('functions/src/domain/vehicleMapPoint.ts');
  for (const part of ['point.rideSessionId !== rideSessionId', 'point.userId !== driverUserId', 'point.role !== "driver"',
    '!hasGeographicCoordinates(point)', 'point.capturedAt > now']) assert(project.includes(part));
});
test('the map uses updated marker state and frames the actual point without inventing a route-anchor position', () => {
  const marker = text(base + 'ui/VehicleMapMarker.kt');
  assert(marker.includes('rememberUpdatedMarkerState(LatLng(point.lat, point.lng))'));
  assert(marker.includes('if (stale) BitmapDescriptorFactory.HUE_ORANGE else BitmapDescriptorFactory.HUE_GREEN'));
  const map = text(base + 'ui/GoogleMapsRoutePreview.kt');
  assert(map.includes('vehiclePoint = ride.vehiclePoint')); assert(map.includes('vehiclePoint?.let { VehicleMapMarker(it, vehicleStale) }'));
  assert(map.includes('vehiclePoint?.let { LatLng(it.lat, it.lng) }')); assert(!map.includes('RoutePreviewOverlay'));
  assert(text(base + 'ui/RideMonitorScreen.kt').includes('"Arrivée estimée", ride.etaLabel'));
});
test('a positive service report is written only after owned runtime and endpoint disposal', () => {
  const owner = text('scripts/qa/run-local-vehicle-map-services.mjs');
  assert(owner.indexOf('runtime.cleanup()') < owner.indexOf('writeFileSync(output, JSON.stringify'));
  assert(owner.indexOf('if (failure) throw failure') < owner.indexOf('writeFileSync(output, JSON.stringify'));
});
test('the portal keeps actual parent screen proof separate from new coordinate-only tests and physical tracking', () => {
  const flow = content.flows.find((row) => row.id === 'ride-observation');
  assert.equal(flow.status, 'partial'); assert.equal(flow.local.groups[0], 'vehicle-map-points');
  assert.match(flow.ui.source, /ride-observation-native-2026-10-19/);
  assert.equal(flow.images.length, 18); assert.equal(flow.tour.length, 9); assert.match(flow.remaining, /vraies positions.*téléphone/);
  assert.equal(flow.images.at(-1).file, 'vehicle-map-unverified');
  assert.match(flow.images.at(-1).alt, /arrêté avant de vérifier le déplacement/);
  assert.equal(content.flows.find((row) => row.id === 'tracking').status, 'partial');
});
test('the latest remote preparation failure cannot become app-flow proof while successful backend checks stay successful', () => {
  const base = 'docs/release/evidence/ci-df9e245-2026-10-19/';
  const checks = JSON.parse(text(base + 'checks.json'));
  assert.equal(checks.headRefOid, 'df9e24587fd0c3b6761d59ffdf289dcd586557a8');
  for (const name of ['Functions and Firebase rules', 'Functions, admin, and website smoke'])
    assert.equal(checks.statusCheckRollup.find((row) => row.name === name).conclusion, 'SUCCESS');
  assert.equal(checks.statusCheckRollup.find((row) => row.name === 'Android native UI tests').conclusion, 'FAILURE');
  const receipt = JSON.parse(text(base + 'device-setup.json'));
  assert.equal(receipt.storePauseFailure.stage, 'stopped-verification'); assert.equal(receipt.storePauseFailure.restored, true);
});
