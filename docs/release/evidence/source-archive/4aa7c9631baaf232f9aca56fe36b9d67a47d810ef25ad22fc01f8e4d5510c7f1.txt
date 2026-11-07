import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageSize } from 'image-size';

export function assertVehicleMapDisplay(marker, runId, rideId, directory) {
  assert.equal(marker.scope, 'local-authenticated-vehicle-marker-real-map-not-physical-gps');
  assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.equal(marker.runId, runId); assert.equal(marker.rideSessionId, rideId);
  assert.equal(marker.parentUid, 'sgm-qa-parent'); assert.equal(marker.driverUid, 'sgm-qa-driver');
  for (const flag of ['sdkLoaded', 'parentSignedOut', 'firestoreClientTerminated']) assert.equal(marker[flag], true);
  for (const flag of ['physicalDevice', 'providerTrackingVerified', 'childPositionsVerified', 'etaVerified']) assert.equal(marker[flag], false);
  assert.equal(marker.points?.length, 2); assert.equal(marker.displays?.length, 2);
  for (const [index, [lat, lng]] of [[50.75, 4.55], [50.815, 4.42]].entries()) {
    const point = marker.points[index]; assert.equal(point.lat, lat); assert.equal(point.lng, lng);
    assert(Number.isSafeInteger(point.capturedAt) && point.capturedAt > 0);
    if (index) assert(point.capturedAt > marker.points[0].capturedAt);
    const display = marker.displays[index]; assert.equal(display.capture, 'native-display');
    assert.equal(display.screenFile, `local-vehicle-map-${index ? 'moved' : 'first'}.png`);
    assert(Number.isInteger(display.samples) && display.samples > 1000);
    assert(Number.isInteger(display.colorBins) && display.colorBins >= 16 && display.colorBins <= Math.min(4096, display.samples));
    assert(Number.isFinite(display.dominantFraction) && display.dominantFraction >= 1 / display.colorBins && display.dominantFraction < 0.85);
    assert(Number.isInteger(display.greenPixels) && display.greenPixels >= 50);
    const rectangle = (value) => {
      for (const key of ['left', 'top', 'right', 'bottom']) assert(Number.isInteger(value?.[key]) && value[key] >= 0);
      assert(value.right > value.left && value.bottom > value.top); return value;
    };
    const map = rectangle(display.mapBounds), pin = rectangle(display.markerBounds);
    assert(map.right - map.left >= 200 && map.bottom - map.top >= 200);
    assert(pin.left >= map.left && pin.top >= map.top && pin.right <= map.right && pin.bottom <= map.bottom);
    assert(pin.right - pin.left >= 12 && pin.right - pin.left <= 200 && pin.bottom - pin.top >= 12 && pin.bottom - pin.top <= 240);
    for (const name of ['departureBounds', 'arrivalBounds']) {
      const anchor = rectangle(display[name]);
      assert(anchor.left >= map.left && anchor.top >= map.top && anchor.right <= map.right && anchor.bottom <= map.bottom);
      if (index) for (const key of ['left', 'top', 'right', 'bottom'])
        assert(Math.abs(anchor[key] - marker.displays[0][name][key]) <= 3, 'Camera movement must not masquerade as vehicle movement');
    }
    assert.match(display.sha256, /^[a-f0-9]{64}$/);
    const bytes = readFileSync(resolve(directory, display.screenFile));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), display.sha256);
    const image = imageSize(bytes); assert.equal(image.type, 'png');
    assert(map.right <= image.width && map.bottom <= image.height);
  }
  assert.notEqual(marker.displays[0].sha256, marker.displays[1].sha256, 'One capture cannot stand in for movement');
  assert.deepEqual(marker.displays[0].mapBounds, marker.displays[1].mapBounds);
  assert(Number.isFinite(marker.markerMovementPixels));
  const [first, moved] = marker.displays.map((display) => display.markerBounds);
  const distance = Math.hypot((moved.left + moved.right - first.left - first.right) / 2,
    (moved.top + moved.bottom - first.top - first.bottom) / 2);
  assert(distance >= 24 && Math.abs(distance - marker.markerMovementPixels) <= 1.5);
  return { scope: marker.scope, markerMovementVerified: true, physicalDevice: false };
}
