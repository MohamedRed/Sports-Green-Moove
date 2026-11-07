import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';

export async function seedTripCancellationUi() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet QA annulé par le conducteur',
    seatsTotal: 4, seatsAvailable: 3, priceCents: 250 });
  const { bookingId: paidId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 2 }));
  await call('approveBooking', driver, { bookingId: paidId });
  // Isolated metadata only: no payment is created or settled by this fixture.
  await db.collection('bookings').doc(paidId).update({ paymentStatus: 'paid' });
  const { bookingId: pendingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
  assert.equal((await document('trips', tripId)).seatsAvailable, 1);
  return { tripId, paidId, pendingId };
}

export async function verifyTripCancellationUi(fixture) {
  const { tripId, paidId, pendingId } = fixture;
  const trip = await document('trips', tripId);
  const receipt = await document('tripCancellations', tripId);
  assert.equal(trip.status, 'cancelled'); assert.equal(trip.seatsTotal, 4); assert.equal(trip.seatsAvailable, 3);
  assert.equal(trip.cancelledByUserId, 'sgm-qa-driver'); assert.equal(trip.cancelReason, 'Match reporté après contrôle local');
  assert.deepEqual(trip.approvedPassengerUserIds, []);
  assert.equal(receipt.tripId, tripId); assert.equal(receipt.actorUserId, 'sgm-qa-driver');
  assert.equal(receipt.reason, trip.cancelReason); assert.equal(receipt.refundPendingCount, 1);
  assert.equal(receipt.seatsAvailable, 3); assert.deepEqual(receipt.bookingIds, [paidId, pendingId].sort());
  assert.equal(receipt.cancelledAt.toMillis(), trip.cancelledAt.toMillis());
  for (const id of [paidId, pendingId]) {
    const booking = await document('bookings', id);
    assert.equal(booking.status, 'cancelled'); assert.equal(booking.cancelledByUserId, 'sgm-qa-driver');
    assert.equal(booking.refundStatus, id === paidId ? 'pending' : 'notRequired');
    assert.equal(booking.cancelledAt.toMillis(), receipt.cancelledAt.toMillis());
  }
  const notes = await db.collection('notifications').where('sourceId', '==', tripId).where('type', '==', 'tripCancelled').get();
  assert.equal(notes.size, 1); assert.equal(notes.docs[0].get('userId'), 'sgm-qa-parent');
  assert.deepEqual(notes.docs[0].get('bookingIds'), receipt.bookingIds);
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const confirmed = await call('getTripCancellation', driver, { tripId });
  const intent = { tripId, requestId: receipt.requestId, expectedRevision: receipt.expectedRevision, reason: receipt.reason };
  assert.deepEqual(await call('cancelTrip', driver, intent), confirmed);
  await denied('cancelTrip', driver, { ...intent, requestId: randomUUID() }, 'ALREADY_EXISTS');
  await denied('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }), 'FAILED_PRECONDITION');
  await denied('approveBooking', driver, { bookingId: pendingId }, 'FAILED_PRECONDITION');
  await denied('startRide', driver, { tripId }, 'FAILED_PRECONDITION');
  assert.deepEqual(await document('tripCancellations', tripId), receipt);
  assert.deepEqual(await document('trips', tripId), trip);
  assert.equal((await db.collection('notifications').where('sourceId', '==', tripId).where('type', '==', 'tripCancelled').get()).size, 1);
  return { method: 'app-ui-with-independent-persisted-checks', tripId, receipt: confirmed,
    bookingCount: 2, notificationCount: 1, refundPendingCount: 1,
    seatsInitiallyOffered: 3, seatsAfterApproval: 1, seatsAfterCancellation: 3,
    parentCancelledReservationsVisible: true, parentPendingRefundVisible: true,
    repeatedRequestIdempotent: true, rebookApproveStartDenied: true,
    syntheticPaymentMetadata: true, livePayment: false, refundIssued: false, productionDeployed: false };
}
