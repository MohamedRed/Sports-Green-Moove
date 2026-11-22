import assert from 'node:assert/strict';
import { db, signIn, call, denied, document } from './local-flow-client.mjs';

export async function verifyLocalMultiSeatSdk(tripId) {
  assert(typeof tripId === 'string' && tripId.length > 0);
  const snapshot = await db.collection('bookings').where('tripId', '==', tripId).get();
  assert.equal(snapshot.size, 1, 'Exactly one native SDK booking must be persisted');
  const booking = snapshot.docs[0];
  assert.equal(booking.get('parentUserId'), 'sgm-qa-parent');
  assert.equal(booking.get('childId'), 'sgm-qa-child-lina');
  assert.equal(booking.get('seats'), 2);
  assert.equal(booking.get('status'), 'requested');
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  const driver = await signIn('d@example.test');
  const parent = await signIn('p@example.test');
  await call('approveBooking', driver, { bookingId: booking.id });
  assert.equal((await document('trips', tripId)).seatsAvailable, 2);
  const queue = await call('listDriverBookingRequests', driver);
  assert.equal(queue.bookings.find((item) => item.bookingId === booking.id)?.seats, 2);
  await call('cancelBooking', parent, { bookingId: booking.id, reason: 'Local native SDK two-seat cleanup' });
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  await denied('cancelBooking', parent, { bookingId: booking.id }, 'FAILED_PRECONDITION');
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  return { method: 'native-sdk-not-ui', requestedSeats: 2, seatsBefore: 4,
    seatsAfterApproval: 2, seatsAfterCancellation: 4, repeatedCancellationRejected: true,
    limitation: 'The booking request used the native gateway; approval and cancellation used authenticated local service calls, not UI.' };
}
