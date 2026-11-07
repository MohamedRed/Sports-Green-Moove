import assert from 'node:assert/strict';

export function assertRealMapsUiProviderEvidence(result, provider, runId) {
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, runId);
  assert.equal(result.status, 'passed');
  assert.equal(result.scope, 'native-ui-with-local-callables-and-explicit-real-maps-not-physical-device');
  assert.equal(result.native.runId, runId); assert.equal(result.native.tripId, result.tripId);
  for (const key of ['completed', 'realSuggestionsSelected', 'unconfirmedPlaceBlocked', 'bothParentsConfirmedInApp',
    'originalTripKeptBeforeApplication', 'parentsCannotApply', 'routeQuoteRequired', 'driverAppliedInApp']) assert.equal(result.native[key], true, key);
  assert.equal(result.nativeUi, true); assert.equal(result.quoteThroughCallable, true);
  assert.equal(result.parentCount, 2); assert.equal(result.acceptedParentCount, 2);
  for (const key of ['physicalDevice', 'productionDataWritten', 'paymentExercised', 'refundIssued']) assert.equal(result[key], false, key);
  assert.deepEqual(provider.requests.map((r) => r.operation), ['autocomplete', 'place-details', 'autocomplete', 'place-details', 'compute-route']);
  assert(provider.requests.every((r) => r.status === 200 && r.completed === true));
  assert.equal(provider.facts.length, 5);
  const details = provider.facts.filter((f) => f.operation === 'place-details');
  assert.deepEqual(details.map((f) => f.placeId), result.native.selectedPlaceIds);
  assert.equal(new Set(result.native.selectedPlaceIds).size, 2);
  assert.deepEqual(details.map((f) => ({ lat: f.location.latitude, lng: f.location.longitude })), [result.savedTrip.origin, result.savedTrip.destination]);
  const route = provider.facts.filter((f) => f.operation === 'compute-route'); assert.equal(route.length, 1);
  assert.equal(route[0].distanceMeters, result.route.distanceMeters);
  assert.match(route[0].duration, /^[0-9]+(?:\.[0-9]+)?s$/);
  assert.equal(Math.round(Number(route[0].duration.slice(0, -1))), result.route.durationSeconds);
  assert.equal(route[0].polylineSha256, result.savedTrip.polylineSha256);
  assert.match(route[0].polylineSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.savedTrip.distanceKm, result.route.distanceMeters / 1000);
  assert.equal(result.savedTrip.routeDurationSeconds, result.route.durationSeconds);
}
