import assert from 'node:assert/strict';
import { snapshotSessionRestorationRecords } from './session-restoration-records.mjs';
import { expectedSearchBookingNotices } from './search-booking-checkpoint.mjs';

export async function snapshotSearchBookingRecords(db, auth, database) {
  const state = await snapshotSessionRestorationRecords(db, auth, database);
  for (const row of state.documents.users ?? []) if (row.id === 'sgm-qa-driver') delete row.data.updatedAt;
  return state;
}

export function verifySearchBookingIsolation(before, after, { tripId, bookingId }) {
  const sanitized = structuredClone(after), baseline = structuredClone(before);
  const ownBooking = (sanitized.documents.bookings ?? []).filter(row => row.data.tripId === tripId);
  assert.equal(ownBooking.length, 1); assert.equal(ownBooking[0].id, bookingId);
  assert.equal(ownBooking[0].data.status, 'cancelled');
  sanitized.documents.bookings = (sanitized.documents.bookings ?? []).filter(row => row.id !== bookingId);
  const ownReceipts = (sanitized.documents.bookingRequestReceipts ?? []).filter(row => row.data.response?.bookingId === bookingId);
  assert.equal(ownReceipts.length, 1);
  sanitized.documents.bookingRequestReceipts = (sanitized.documents.bookingRequestReceipts ?? []).filter(row =>
    row.data.response?.bookingId !== bookingId);
  const ownNotes = (sanitized.documents.notifications ?? []).filter(row => row.data.sourceId === bookingId);
  assert.deepEqual(ownNotes.map(row => [row.data.type, row.data.userId]).sort(), expectedSearchBookingNotices('cancelled').sort());
  sanitized.documents.notifications = (sanitized.documents.notifications ?? []).filter(row => row.data.sourceId !== bookingId);
  const oldTrip = baseline.documents.trips.find(row => row.id === tripId);
  const newTrip = sanitized.documents.trips.find(row => row.id === tripId);
  assert(oldTrip && newTrip); delete oldTrip.data.updatedAt; delete newTrip.data.updatedAt;
  // Capacity returns to four; only the owned trip's timestamp is left different.
  for (const value of [baseline, sanitized]) for (const [name, rows] of Object.entries(value.documents))
    if (rows.length === 0) delete value.documents[name];
  assert.deepEqual(sanitized, baseline, 'Unrelated records, claims and live trips must remain unchanged');
  return { unrelatedDocumentsUnchanged: true, allClaimsUnchanged: true, liveTripsUnchanged: true,
    ownNewBookings: 1, ownNewRequestReceipts: 1, ownNewNotifications: 3 };
}
