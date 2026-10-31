import assert from 'node:assert/strict';
import {bookingReceiptTarget} from './booking-receipt-target.mjs';

export function verifyChildBookingReservation(page, target, bookingId) {
  assert.equal(bookingReceiptTarget(target).subject, 'child-search-two-seats');
  assert(Array.isArray(page.items));
  const rows = page.items.filter(row => row.bookingId === bookingId); assert.equal(rows.length, 1);
  for (const [key, value] of Object.entries({tripId: target.tripId, childId: target.childId, seats: 2, status: 'requested',
    parentUserId: 'sgm-qa-parent'})) assert.equal(rows[0][key], value, key);
  return rows[0];
}

export function verifyChildBookingReceiptRecords(baseline, after, target, expectedBookingId) {
  assert.equal(bookingReceiptTarget(target).subject, 'child-search-two-seats');
  const added = name => (after.documents[name] ?? []).filter(row => !(baseline.documents[name] ?? []).some(old => old.id === row.id));
  const bookings = added('bookings'), receipts = added('bookingRequestReceipts'), notifications = added('notifications');
  assert.equal(bookings.length, 1); assert.equal(receipts.length, 1); assert.equal(notifications.length, 1);
  const booking = bookings[0]; if (expectedBookingId) assert.equal(booking.id, expectedBookingId);
  for (const [key, value] of Object.entries({tripId: target.tripId, seats: 2, childId: target.childId, status: 'requested',
    parentUserId: 'sgm-qa-parent', requesterUserId: 'sgm-qa-parent', driverUserId: 'sgm-qa-driver'})) assert.equal(booking.data[key], value, key);
  for (const key of ['paymentStatus', 'paymentIntentId', 'approvedAt', 'cancelledAt']) assert.equal(booking.data[key], undefined, key);
  assert.deepEqual(booking.data.createdAt, booking.data.updatedAt);
  const receipt = receipts[0].data;
  assert.equal(receipt.uid, 'sgm-qa-parent'); assert.equal(receipt.state, 'committed');
  assert.equal(receipt.response.bookingId, booking.id); assert.equal(receipt.response.status, 'requested');
  assert.equal(receipt.response.trip.id, target.tripId); assert.equal(receipt.response.trip.bookingIntent.terms.priceCents, 0);
  const notice = notifications[0].data;
  assert.equal(notice.userId, 'sgm-qa-driver'); assert.equal(notice.type, 'bookingRequested'); assert.equal(notice.sourceId, booking.id);
  const ownTrip = after.documents.trips.find(row => row.id === target.tripId);
  assert(ownTrip); assert.equal(ownTrip.data.priceCents, 0); assert.equal(ownTrip.data.seatsTotal, 4); assert.equal(ownTrip.data.seatsAvailable, 4);
  const stripped = structuredClone(after);
  for (const [name, rows] of [['bookings', bookings], ['bookingRequestReceipts', receipts], ['notifications', notifications]]) {
    stripped.documents[name] = stripped.documents[name].filter(row => !rows.some(owned => owned.id === row.id));
    if (!(name in baseline.documents) && stripped.documents[name].length === 0) delete stripped.documents[name];
  }
  assert.deepEqual(stripped, baseline, 'Only one owned booking, receipt and driver notification may be added');
  return {bookingId: booking.id, tripId: target.tripId, childId: target.childId, seats: 2,
    bookingCount: 1, receiptCount: 1, notificationCount: 1, unrelatedRecordsAndClaimsUnchanged: true};
}
