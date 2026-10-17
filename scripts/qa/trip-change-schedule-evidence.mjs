import assert from 'node:assert/strict';
import { unchangedTripDetails } from './trip-change-inputs-evidence.mjs';

export function tripScheduleFixtureTimes(now = Date.now()) {
  assert(Number.isFinite(now));
  const departure = new Date(now + 24 * 3600_000);
  departure.setUTCHours(9, 0, 0, 0);
  const originalDepartureAt = departure.toISOString();
  const proposedDepartureAt = new Date(departure.getTime() + 24 * 3600_000).toISOString();
  const desiredArrivalBy = new Date(Date.parse(proposedDepartureAt) + 3600_000).toISOString();
  const pastDepartureAt = new Date(departure.getTime() - 48 * 3600_000).toISOString();
  return { originalDepartureAt, proposedDepartureAt, desiredArrivalBy, pastDepartureAt };
}

export function assertTripScheduleReceipt(receipt, fixture, runId) {
  assert.equal(receipt.projectId, 'demo-sgm-local-qa'); assert.equal(receipt.runId, runId);
  assert.equal(receipt.scope, 'native-trip-change-date-and-arrival-consent-ui'); assert.equal(receipt.completed, true);
  for (const key of ['tripId', 'bookingId', 'originalDepartureAt', 'proposedDepartureAt', 'desiredArrivalBy']) {
    assert.equal(receipt[key], fixture[key], key);
  }
  for (const key of ['nativeDatePickerUsed', 'nativeTimePickerUsed', 'dateCancellationPreservedDraft', 'pastDepartureBlocked',
    'arrivalBeforeDepartureBlocked', 'desiredArrivalAdded', 'parentSawDatesAndArrival', 'parentConfirmed', 'notApplied']) {
    assert.equal(receipt[key], true, key);
  }
}

export function assertTripScheduleRecords({ trip, booking, change, proposalId, driverUid, parentUid }, fixture) {
  assert.deepEqual(unchangedTripDetails(trip), fixture.before, 'A confirmed schedule is still only a proposal');
  assert.deepEqual(booking, fixture.bookingBefore, 'Schedule consent must not alter booking or payment state');
  assert.equal(trip.pendingChangeId, proposalId); assert.equal(change.status, 'confirmed');
  assert.equal(change.tripId, fixture.tripId); assert.equal(change.driverUserId, driverUid);
  assert.deepEqual(change.parentUserIds, [parentUid]); assert.deepEqual(change.bookingIds, [fixture.bookingId]);
  assert.deepEqual(Object.keys(change.decisions), [parentUid]); assert.equal(change.decisions[parentUid].decision, 'accept');
  assert.equal(change.application, undefined);
  assert.equal(Date.parse(change.originalTerms.departureAt), Date.parse(fixture.originalDepartureAt));
  assert.equal(Date.parse(change.terms.departureAt), Date.parse(fixture.proposedDepartureAt));
  assert.notEqual(Date.parse(change.terms.departureAt), Date.parse(change.originalTerms.departureAt));
  assert.equal(change.originalTerms.arrivalBy, null);
  assert.equal(Date.parse(change.terms.arrivalBy), Date.parse(fixture.desiredArrivalBy));
  assert(Date.parse(change.terms.arrivalBy) > Date.parse(change.terms.departureAt));
  for (const terms of [change.originalTerms, change.terms]) {
    assert.equal(terms.priceCents, 250);
    for (const key of ['origin', 'destination']) assert.deepEqual(terms[key], fixture.before[key]);
  }
}
