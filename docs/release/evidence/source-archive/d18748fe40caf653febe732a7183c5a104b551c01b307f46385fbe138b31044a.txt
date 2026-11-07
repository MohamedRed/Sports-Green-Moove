import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeCancellationProfiles} from './trip-cancellation-phone-checkpoints.mjs';

export const staleCancellationPhonePhases = ['driver-signed-in', 'preview-visible', 'peer-approved',
  'stale-not-confirmed', 'preview-refreshed', 'cancellation-confirmed', 'driver-history', 'signed-out'];

function timestamp(value) {
  assert(value && Number.isSafeInteger(value._seconds) && Number.isInteger(value._nanoseconds));
  assert(value._nanoseconds >= 0 && value._nanoseconds < 1_000_000_000); return value;
}
export function verifyPeerApproval(before, current, fixture) {
  const original = normalizeCancellationProfiles(before, fixture), after = normalizeCancellationProfiles(current, fixture);
  const oldTrip = original.documents.trips.find(row => row.id === fixture.tripId)?.data;
  const newTrip = after.documents.trips.find(row => row.id === fixture.tripId);
  const oldBooking = original.documents.bookings.find(row => row.id === fixture.pendingBookingId)?.data;
  const newBooking = after.documents.bookings.find(row => row.id === fixture.pendingBookingId);
  assert(oldTrip && oldBooking && newTrip && newBooking); assert.equal(oldTrip.seatsAvailable, 2);
  assert.equal(oldTrip.status, 'published'); assert.equal(oldBooking.status, 'requested'); assert.equal(oldBooking.seats, 1);
  assert.deepEqual(newTrip.data, {...oldTrip, seatsAvailable: 1, updatedAt: timestamp(newTrip.data.updatedAt)});
  assert.deepEqual(newBooking.data, {...oldBooking, status: 'approved', approvedAt: timestamp(newBooking.data.approvedAt),
    updatedAt: timestamp(newBooking.data.updatedAt)});
  const notices = after.documents.notifications.filter(row => !original.documents.notifications.some(old => old.id === row.id));
  assert.equal(notices.length, 1); const notice = notices[0], uid = oldBooking.parentUserId;
  const id = 'bookingDecision_' + createHash('sha256').update(JSON.stringify(['bookingApproved', fixture.pendingBookingId, uid])).digest('hex');
  assert.equal(notice.id, id);
  assert.deepEqual(notice.data, {type: 'bookingApproved', title: 'Réservation approuvée',
    body: fixture.title + ' est approuvé par le conducteur.', sourceId: fixture.pendingBookingId, userId: uid,
    read: false, createdAt: timestamp(notice.data.createdAt)});
  newTrip.data = structuredClone(oldTrip); newBooking.data = structuredClone(oldBooking);
  after.documents.notifications = after.documents.notifications.filter(row => row.id !== id);
  assert.deepEqual(after, original, 'Only this approval may change; closed bookings, other users and live tracking remain untouched');
  return {seatsAvailable: 1, newApprovalNotices: 1, newCancellations: 0, protectedRecordsUnchanged: true};
}
