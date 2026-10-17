import assert from 'node:assert/strict';

export const unchangedTripDetails = (trip) => Object.fromEntries(Object.entries(trip)
  .filter(([key]) => !['pendingChangeId', 'updatedAt'].includes(key)));

export function assertTripChangeInputsReceipt(receipt, { tripId, bookingId, originalDepartureAt, proposedDepartureAt }, runId) {
  assert.equal(receipt.projectId, 'demo-sgm-local-qa'); assert.equal(receipt.runId, runId);
  assert.equal(receipt.scope, 'native-trip-change-time-and-address-safety-ui'); assert.equal(receipt.completed, true);
  for (const [key, expected] of Object.entries({ tripId, bookingId, originalDepartureAt, proposedDepartureAt })) {
    assert.equal(receipt[key], expected, key);
  }
  for (const key of ['nativeTimePickerUsed', 'unconfirmedOriginBlocked', 'unconfirmedDestinationBlocked',
    'originalPlacesExplicitlyKept', 'parentSawBothTimes', 'parentConfirmed', 'missingRouteBlockedApplication']) {
    assert.equal(receipt[key], true, key);
  }
}

export function assertTripChangeInputsRecords({ trip, booking, change, proposalId, parentUid, driverUid }, fixture) {
  assert.deepEqual(unchangedTripDetails(trip), fixture.before, 'Unapplied time changes must not alter the original trip');
  assert.deepEqual(booking, fixture.bookingBefore, 'Consent must not change a reservation or its payment');
  assert.equal(trip.pendingChangeId, proposalId); assert.equal(change.status, 'confirmed');
  assert.equal(change.tripId, fixture.tripId); assert.equal(change.driverUserId, driverUid);
  assert.deepEqual(change.parentUserIds, [parentUid]); assert.deepEqual(change.bookingIds, [fixture.bookingId]);
  assert.deepEqual(Object.keys(change.decisions), [parentUid]); assert.equal(change.decisions[parentUid].decision, 'accept');
  assert.equal(change.application, undefined);
  assert.equal(Date.parse(change.originalTerms.departureAt), Date.parse(fixture.originalDepartureAt));
  assert.equal(Date.parse(change.terms.departureAt), Date.parse(fixture.proposedDepartureAt));
  assert.notEqual(Date.parse(change.terms.departureAt), Date.parse(change.originalTerms.departureAt));
  assert.equal(change.originalTerms.priceCents, 250); assert.equal(change.terms.priceCents, 400);
  for (const key of ['origin', 'destination']) {
    assert.deepEqual(change.originalTerms[key], fixture.before[key]);
    assert.deepEqual(change.terms[key], fixture.before[key], 'Unconfirmed text must never become coordinates');
  }
  assert.equal(change.originalTerms.arrivalBy, null); assert.equal(change.terms.arrivalBy, null);
}
