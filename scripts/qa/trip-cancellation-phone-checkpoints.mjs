import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const cancellationPhoneReason = 'Entrainement reporte pour cet essai';
export const cancellationPhonePhases = ['driver-signed-in', 'preview-visible', 'preview-dismissed', 'preview-reopened',
  'cancellation-confirmed', 'driver-history', 'process-restarted', 'parent-reservations', 'parent-inbox',
  'second-parent-reservations', 'second-parent-inbox', 'signed-out'];

export function normalizeCancellationProfiles(state, fixture) {
  const value = structuredClone(state);
  for (const row of value.documents.users ?? [])
    if ([fixture.driverUid, ...fixture.parentUids].includes(row.id)) delete row.data.updatedAt;
  return value;
}

export function verifyCancellationPhoneCheckpoint(phase, baseline, current, fixture) {
  return verifyCancellationWithCapacity(phase, baseline, current, fixture, 2);
}

export function verifyCancellationWithCapacity(phase, baseline, current, fixture, initialAvailableSeats) {
  assert(Number.isInteger(initialAvailableSeats) && initialAvailableSeats >= 0 && initialAvailableSeats <= 4);
  const index = cancellationPhonePhases.indexOf(phase); assert(index >= 0, 'Unknown cancellation checkpoint');
  const before = normalizeCancellationProfiles(baseline, fixture), after = normalizeCancellationProfiles(current, fixture);
  assert.equal(fixture.driverUid, 'sgm-qa-driver'); assert.equal(fixture.activeBookingIds.length, 2);
  assert.equal(new Set(fixture.activeBookingIds).size, 2); assert.equal(new Set(fixture.parentUids).size, 2);
  assert.equal(fixture.initialPreview.status, 'ready'); assert.equal(fixture.initialPreview.bookingCount, 2);
  assert.equal(fixture.initialPreview.refundPendingCount, 0); assert.match(fixture.initialPreview.revision, /^[a-f0-9]{64}$/);
  assert(!(before.documents.tripCancellations ?? []).some(row => row.id === fixture.tripId));
  if (index < 4) {
    assert.deepEqual(after, before, 'Opening or dismissing cancellation must not write business records');
    return {phase, cancelledBookings: 0, newCancellationReceipts: 0, newNotices: 0, phoneUiProven: false};
  }
  const added = name => (after.documents[name] ?? []).filter(row => !(before.documents[name] ?? []).some(old => old.id === row.id));
  const receipts = added('tripCancellations'); assert.equal(receipts.length, 1); assert.equal(receipts[0].id, fixture.tripId);
  const receipt = receipts[0].data, time = receipt.cancelledAt;
  assert(time && Number.isSafeInteger(time._seconds) && Number.isInteger(time._nanoseconds));
  assert(time._nanoseconds >= 0 && time._nanoseconds < 1_000_000_000);
  assert.match(receipt.requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
  assert.deepEqual(receipt, {tripId: fixture.tripId, actorUserId: fixture.driverUid, requestId: receipt.requestId,
    expectedRevision: fixture.initialPreview.revision, reason: cancellationPhoneReason, cancelledAt: time,
    bookingIds: fixture.activeBookingIds.slice().sort(), refundPendingCount: 0, seatsAvailable: 4});
  const tripBefore = before.documents.trips.find(row => row.id === fixture.tripId)?.data;
  const trip = after.documents.trips.find(row => row.id === fixture.tripId); assert(tripBefore && trip);
  assert.equal(tripBefore.priceCents, 0); assert.equal(tripBefore.seatsAvailable, initialAvailableSeats); assert.equal(tripBefore.seatsTotal, 4);
  const approvedSeats = fixture.activeBookingIds.reduce((sum, id) => {
    const data = before.documents.bookings.find(row => row.id === id).data;
    assert(Number.isInteger(data.seats) && data.seats > 0); return sum + (data.status === 'approved' ? data.seats : 0);
  }, 0);
  assert.equal(approvedSeats, 4 - initialAvailableSeats);
  assert(!tripBefore.pendingChangeId && !tripBefore.activeRideSessionId);
  assert.deepEqual(trip.data, {...tripBefore, status: 'cancelled', seatsAvailable: 4, approvedPassengerUserIds: [],
    cancelledAt: time, cancelledByUserId: fixture.driverUid, cancelReason: cancellationPhoneReason, updatedAt: time});
  for (const id of fixture.activeBookingIds) {
    const original = before.documents.bookings.find(row => row.id === id)?.data;
    const booking = after.documents.bookings.find(row => row.id === id); assert(original && booking);
    assert.equal(original.tripId, fixture.tripId); assert.equal(original.driverUserId, fixture.driverUid);
    assert(fixture.parentUids.includes(original.parentUserId)); assert(['requested', 'approved'].includes(original.status));
    assert(!original.paymentIntentId && !original.paymentAttempt && original.paymentStatus !== 'paid');
    assert.deepEqual(booking.data, {...original, status: 'cancelled', cancelledAt: time,
      cancelledByUserId: fixture.driverUid, cancelReason: cancellationPhoneReason, refundStatus: 'notRequired', updatedAt: time});
    booking.data = structuredClone(original);
  }
  const notices = added('notifications'); assert.equal(notices.length, 2);
  for (const uid of fixture.parentUids) {
    const id = 'tripCancelled_' + createHash('sha256').update(JSON.stringify([fixture.tripId, uid])).digest('hex');
    const notice = notices.find(row => row.id === id); assert(notice);
    const bookingIds = fixture.activeBookingIds.filter(bookingId =>
      before.documents.bookings.find(row => row.id === bookingId).data.parentUserId === uid).sort();
    assert.deepEqual(notice.data, {userId: uid, type: 'tripCancelled', title: 'Trajet annulé', body: cancellationPhoneReason,
      sourceId: fixture.tripId, bookingIds, read: false, createdAt: time});
  }
  trip.data = structuredClone(tripBefore);
  for (const [name, rows] of [['tripCancellations', receipts], ['notifications', notices]]) {
    after.documents[name] = after.documents[name].filter(row => !rows.some(owned => owned.id === row.id));
    if (!(name in before.documents) && !after.documents[name].length) delete after.documents[name];
  }
  assert.deepEqual(after, before, 'Closed bookings, unrelated records, claims and live trips must remain unchanged');
  return {phase, cancelledBookings: 2, newCancellationReceipts: 1, newNotices: 2, returnedSeats: approvedSeats,
    seatsAvailable: 4, refundRequired: false, protectedRecordsUnchanged: true, phoneUiProven: false};
}
