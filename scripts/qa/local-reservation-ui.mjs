import assert from 'node:assert/strict';
import { signIn, call, db, document, tripInput } from './local-flow-client.mjs';

export async function seedReservationUiFixtures() {
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  const records = {};
  for (const [key, title, approved] of [
    ['requested', 'Trajet QA annulation demandée', false],
    ['approved', 'Trajet QA annulation approuvée', true],
    ['declined', 'Trajet QA à refuser', false],
  ]) {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), title });
    const { bookingId } = await call('requestBooking', parent, { tripId, childId: 'sgm-qa-child-lina', seats: 2 });
    if (approved) await call('approveBooking', driver, { bookingId });
    assert.equal((await document('trips', tripId)).seatsAvailable, approved ? 2 : 4);
    records[key] = { bookingId, tripId };
  }
  return records;
}

export async function verifyReservationUi(fixture) {
  for (const [key, item] of Object.entries(fixture)) {
    const booking = await document('bookings', item.bookingId);
    assert.equal(booking.status, key === 'declined' ? 'declined' : 'cancelled');
    assert.equal(booking.parentUserId, 'sgm-qa-parent');
    assert.equal(booking.driverUserId, 'sgm-qa-driver');
    assert.equal(booking.childId, 'sgm-qa-child-lina');
    assert.equal(booking.seats, 2);
    assert.equal((await document('trips', item.tripId)).seatsAvailable, 4);
    const type = key === 'declined' ? 'bookingDeclined' : 'bookingCancelled';
    const notes = await db.collection('notifications').where('sourceId', '==', item.bookingId).where('type', '==', type).get();
    assert.equal(notes.size, 1);
    assert.equal(notes.docs[0].get('userId'), key === 'declined' ? 'sgm-qa-parent' : 'sgm-qa-driver');
    if (key !== 'declined') {
      assert.equal(booking.cancelledByUserId, 'sgm-qa-parent');
      assert.equal(booking.refundStatus, 'notRequired');
    } else assert.equal(booking.declinedByUserId, 'sgm-qa-driver');
  }
  const queue = await call('listDriverBookingRequests', await signIn('d@example.test'));
  assert(queue.bookings.every((booking) => !Object.values(fixture).some((item) => item.bookingId === booking.bookingId)));
  return { method: 'app-ui-with-persisted-checks', requestedCancellation: 'cancelled', approvedCancellation: 'cancelled',
    declinedStatus: 'declined', requestedSeats: 2, approvedSeatsBeforeCancellation: 2, seatsAfterEachDecision: 4,
    notificationCount: 3, livePayment: false };
}
