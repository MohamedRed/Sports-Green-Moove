import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertSearchBookingCheckpoint, searchBookingPhases } from './search-booking-checkpoint.mjs';
import { searchMapsPolicy, searchOperations } from './search-maps-policy.mjs';

export const searchBookingCaptures = ['choices', 'match', 'requested', 'driver-approved', 'parent-approved', 'cancelled']
  .map(stem => `local-parent-search-booking-${stem}.png`);

export function assertSearchBookingEvidence({ native, checkpoints, provider, runId, tripId, readCapture }) {
  assert.equal(native.scope, 'local-parent-search-two-seat-booking-not-physical-or-payment');
  assert.equal(native.runId, runId); assert.equal(native.tripId, tripId); assert.equal(native.projectId, 'demo-sgm-local-qa');
  assert.equal(native.requestedSeats, 2); assert.equal(native.childId, 'sgm-qa-child-lina');
  assert.equal(native.physicalDevice, false); assert.equal(native.paymentExercised, false);
  for (const key of ['parentRequestedInApp', 'driverApprovedInApp', 'parentCancelledInApp', 'parentSignedOut',
    'firestoreClientTerminated', 'completed']) assert.equal(native[key], true, key);
  assert.deepEqual(native.capacitySequence, [4, 4, 2, 2, 4]);
  assert.deepEqual(Object.keys(native.screenshots).sort(), [...searchBookingCaptures].sort());
  for (const name of searchBookingCaptures) {
    const bytes = readCapture(name);
    assert(bytes.length > 1024 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), native.screenshots[name]);
  }
  assert.equal(checkpoints.length, 3);
  checkpoints.forEach((entry, index) => {
    assert.equal(entry.phase, searchBookingPhases[index]); assert.equal(entry.runId, runId);
    assert.equal(entry.bookingId, native.bookingId); assert.equal(entry.tripId, tripId);
    assertSearchBookingCheckpoint(entry.phase, entry.state, { tripId, bookingId: native.bookingId });
  });
  assert.equal(provider.policy, searchMapsPolicy); assert.equal(provider.approvedRequestLimit, 8); assert.equal(provider.stopped, false);
  assert.deepEqual(provider.requests.map(row => row.operation), searchOperations);
  assert(provider.requests.every(row => row.completed && row.status === 200));
  assert.deepEqual(provider.facts.map(row => row.operation), searchOperations);
  assert.deepEqual(native.selectedPlaceIds, provider.facts.filter(row => row.operation === 'place-details').map(row => row.placeId));
  assert.equal(provider.facts[4].elements.length, 9);
  return { actualProviderRequests: 6, matrixElements: 9, independentPersistedCheckpoints: 3,
    requestedSeats: 2, captureCount: 6, physicalDevice: false, paymentExercised: false };
}
