import assert from 'node:assert/strict';

export const directBookingPhonePhases = ['parent-signed-in', 'opened-no-write', 'dismissed-no-write',
  'confirmed', 'reopened', 'process-restarted', 'other-card', 'signed-out'];
export const directBookingPhoneTripId = 'sgm-qa-trip-u8-wavre-bruxelles';

export function verifyDirectBookingCheckpoint(phase, baseline, after, expectedBookingId) {
  const index = directBookingPhonePhases.indexOf(phase); assert(index >= 0);
  if (index < 3) { assert.deepEqual(after, baseline); return {phase, addedBookings: 0, bookingId: null}; }
  const added = (name) => (after.documents[name] ?? []).filter(row => !(baseline.documents[name] ?? []).some(old => old.id === row.id));
  const bookings = added('bookings'), receipts = added('bookingRequestReceipts'), notices = added('notifications');
  assert.equal(bookings.length, 1); assert.equal(receipts.length, 1); assert.equal(notices.length, 1);
  const booking = bookings[0]; if (expectedBookingId) assert.equal(booking.id, expectedBookingId);
  assert.equal(booking.data.parentUserId, 'sgm-qa-parent'); assert.equal(booking.data.tripId, directBookingPhoneTripId);
  assert.equal(booking.data.driverUserId, 'sgm-qa-driver'); assert.equal(booking.data.seats, 1);
  assert.equal(booking.data.childId, undefined); assert.equal(booking.data.status, 'requested');
  assert.equal(receipts[0].data.uid, 'sgm-qa-parent'); assert.equal(receipts[0].data.state, 'committed');
  assert.equal(receipts[0].data.response.bookingId, booking.id);
  assert.equal(notices[0].data.userId, 'sgm-qa-driver'); assert.equal(notices[0].data.type, 'bookingRequested');
  assert.equal(notices[0].data.sourceId, booking.id);
  const stripped = structuredClone(after);
  for (const [name, rows] of [['bookings', bookings], ['bookingRequestReceipts', receipts], ['notifications', notices]]) {
    stripped.documents[name] = stripped.documents[name].filter(row => !rows.some(owned => owned.id === row.id));
    if (!(name in baseline.documents) && stripped.documents[name].length === 0) delete stripped.documents[name];
  }
  assert.deepEqual(stripped, baseline, 'No unrelated record, trip capacity, child booking, claim or live point may change');
  return {phase, addedBookings: 1, bookingId: booking.id};
}
