import assert from 'node:assert/strict';

export const tripDraftPhonePhases = ['driver-signed-in', 'draft-entered', 'other-trip-clean', 'draft-returned',
  'force-stopped', 'draft-reopened', 'other-trip-reopened', 'draft-returned-after-stop', 'signed-out'];

export function verifyTripDraftPhoneCheckpoint(phase, baseline, state, fixture) {
  assert(tripDraftPhonePhases.includes(phase)); assert.notEqual(fixture.tripId, fixture.otherTripId);
  assert.equal(fixture.driverUid, 'sgm-qa-driver'); assert.equal(new Set(fixture.bookingIds).size, 2);
  assert.equal(fixture.bookingIds.length, 2);
  assert.deepEqual(state, baseline, 'A private unsent draft must not change any shared record, account claims or live data');
  assert(Array.isArray(state.claims) && Object.hasOwn(state, 'liveData'));
  for (const tripId of [fixture.tripId, fixture.otherTripId]) {
    const trip = state.documents.trips.find(row => row.id === tripId);
    assert(trip); assert.equal(trip.data.driverUserId, fixture.driverUid); assert.equal(trip.data.priceCents, 250);
    for (const name of ['tripChanges', 'tripChangeQuotes', 'tripChangeBalances', 'rideSessions'])
      assert(!(state.documents[name] ?? []).some(row => row.data.tripId === tripId), 'The phone must not submit a proposal');
  }
  assert.deepEqual(fixture.bookingIds.map(id => state.documents.bookings.find(row => row.id === id)?.data.tripId).sort(),
    [fixture.tripId, fixture.otherTripId].sort());
  return { phase, status: 'passed', sharedRecordsUnchanged: true, accountClaimsUnchanged: true,
    liveDataUnchanged: true, proposalCreated: false, physicalUiProvenByThisCheckpoint: false,
    processStopProvenByThisCheckpoint: false, draftStorageProvenByThisCheckpoint: false };
}
