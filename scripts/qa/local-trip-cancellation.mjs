import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';
import { checkTripCancellationRaces } from './local-trip-cancellation-races.mjs';

export async function checkTripCancellation() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const outsider = await signIn('outsider@example.test');
  const create = async (overrides = {}) => (await call('createTrip', driver, { ...tripInput(), ...overrides })).tripId;
  const preview = (tripId) => call('getTripCancellation', driver, { tripId });
  const intent = (tripId, revision) => ({ tripId, expectedRevision: revision, requestId: randomUUID(), reason: 'Annulation de contrôle local' });
  const tripId = await create({ seatsAvailable: 3, priceCents: 250 });
  const book = async (actor, id = tripId, seats = 1) => (await call('requestBooking', actor, { tripId: id, seats })).bookingId;
  const paid = await book(parent, tripId, 2);
  await call('approveBooking', driver, { bookingId: paid });
  await db.collection('bookings').doc(paid).update({ paymentStatus: 'paid' }); // Synthetic metadata, not a real charge.
  const pending = await book(parent), other = await book(outsider);
  const closed = await book(parent);
  await call('cancelBooking', parent, { bookingId: closed });
  const closedBefore = await document('bookings', closed);
  const first = await preview(tripId);
  assert.equal(first.status, 'ready'); assert.equal(first.bookingCount, 3); assert.equal(first.refundPendingCount, 1);
  const request = intent(tripId, first.revision);
  for (const actor of [parent, outsider, null]) {
    const code = actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED';
    await denied('getTripCancellation', actor, { tripId }, code);
    await denied('cancelTrip', actor, request, code);
  }
  await denied('cancelTrip', driver, { ...request, requestId: 'invalid' }, 'INVALID_ARGUMENT');
  await denied('cancelTrip', driver, { ...request, reason: ' ' }, 'INVALID_ARGUMENT');
  const receipts = await Promise.all([call('cancelTrip', driver, request), call('cancelTrip', driver, request)]);
  assert.deepEqual(receipts[0], receipts[1]);
  const receipt = receipts[0];
  assert.equal(receipt.status, 'cancelled'); assert.equal(receipt.bookingCount, 3);
  assert.equal(receipt.refundPendingCount, 1); assert.equal(receipt.seatsAvailable, 3);
  assert.deepEqual(receipt.bookingIds, [paid, pending, other].sort());
  const storedReceipt = await document('tripCancellations', tripId);
  const savedTrip = await document('trips', tripId);
  assert.equal(savedTrip.status, 'cancelled'); assert.equal(savedTrip.seatsAvailable, 3);
  assert.equal(savedTrip.cancelledByUserId, driver.uid); assert.equal(savedTrip.cancelReason, request.reason);
  for (const bookingId of receipt.bookingIds) {
    const booking = await document('bookings', bookingId);
    assert.equal(booking.status, 'cancelled'); assert.equal(booking.cancelReason, request.reason);
    assert.equal(booking.refundStatus, bookingId === paid ? 'pending' : 'notRequired');
    assert.equal(booking.cancelledAt.toMillis(), storedReceipt.cancelledAt.toMillis());
  }
  assert.deepEqual(await document('bookings', closed), closedBefore);
  const notes = await db.collection('notifications').where('sourceId', '==', tripId).where('type', '==', 'tripCancelled').get();
  assert.equal(notes.size, 2); assert.equal(new Set(notes.docs.map((doc) => doc.data().userId)).size, 2);
  assert.deepEqual(notes.docs.flatMap((doc) => doc.data().bookingIds).sort(), receipt.bookingIds);
  for (const actor of [parent, outsider]) {
    const reservations = await call('listReservations', actor, { role: 'parent' });
    for (const id of actor === parent ? [paid, pending] : [other]) {
      const reservation = reservations.items.find((item) => item.bookingId === id);
      assert(reservation); assert.equal(reservation.status, 'cancelled'); assert.deepEqual(reservation.allowedActions, []);
      if (id === paid) assert.equal(reservation.refundPending, true);
    }
    const inbox = await call('getInbox', actor);
    const noteId = notes.docs.find((doc) => doc.data().userId === actor.uid).id;
    const note = inbox.inbox.notifications.find((note) => note.id === noteId);
    assert(note); assert.equal(note.title, 'Trajet annulé'); assert.equal(note.body, request.reason);
  }
  assert.deepEqual(await call('cancelTrip', driver, request), receipt);
  assert.deepEqual(await preview(tripId), receipt);
  await denied('cancelTrip', driver, { ...request, requestId: randomUUID() }, 'ALREADY_EXISTS');
  await denied('cancelTrip', driver, { ...request, reason: 'Changed cancellation reason' }, 'ALREADY_EXISTS');
  await denied('requestBooking', parent, { tripId, seats: 1 }, 'FAILED_PRECONDITION');
  await denied('approveBooking', driver, { bookingId: pending }, 'FAILED_PRECONDITION');
  await denied('startRide', driver, { tripId }, 'FAILED_PRECONDITION');
  assert.deepEqual(await document('tripCancellations', tripId), storedReceipt);
  assert.deepEqual(await document('trips', tripId), savedTrip);
  assert.equal((await db.collection('notifications').where('sourceId', '==', tripId).where('type', '==', 'tripCancelled').get()).size, 2);

  const stale = await create(), beforeNewBooking = await preview(stale);
  const staleBooking = await book(parent, stale);
  await denied('cancelTrip', driver, intent(stale, beforeNewBooking.revision), 'ABORTED');
  const beforeApproval = await preview(stale);
  await call('approveBooking', driver, { bookingId: staleBooking });
  await denied('cancelTrip', driver, intent(stale, beforeApproval.revision), 'ABORTED');
  const beforePayment = await preview(stale);
  await db.collection('bookings').doc(staleBooking).update({ paymentStatus: 'paid' });
  await denied('cancelTrip', driver, intent(stale, beforePayment.revision), 'ABORTED');
  assert.equal((await document('trips', stale)).status, 'published');
  assert.equal((await db.collection('tripCancellations').doc(stale).get()).exists, false);

  const malformed = await create(), malformedId = await book(parent, malformed);
  for (const bad of [{ seats: 0 }, { seats: 9 }, { driverUserId: parent.uid }, { requesterUserId: outsider.uid }]) {
    const original = await document('bookings', malformedId);
    await db.collection('bookings').doc(malformedId).update(bad);
    await denied('getTripCancellation', driver, { tripId: malformed }, 'FAILED_PRECONDITION');
    await db.collection('bookings').doc(malformedId).set(original);
  }
  const excessiveSeats = await create(), held = await book(parent, excessiveSeats);
  await call('approveBooking', driver, { bookingId: held });
  await db.collection('trips').doc(excessiveSeats).update({ seatsAvailable: 4 });
  await denied('getTripCancellation', driver, { tripId: excessiveSeats }, 'FAILED_PRECONDITION');

  const overLimit = await create();
  const batch = db.batch();
  for (let i = 0; i < 101; i++) batch.create(db.collection('bookings').doc(), {
    tripId: overLimit, driverUserId: driver.uid, parentUserId: parent.uid, seats: 1, status: 'requested' });
  await batch.commit();
  await denied('getTripCancellation', driver, { tripId: overLimit }, 'RESOURCE_EXHAUSTED');
  await denied('cancelTrip', driver, intent(overLimit, '0'.repeat(64)), 'RESOURCE_EXHAUSTED');
  assert.equal((await document('trips', overLimit)).status, 'published');
  assert.equal((await db.collection('tripCancellations').doc(overLimit).get()).exists, false);
  const excess = await db.collection('bookings').where('tripId', '==', overLimit).get();
  assert.equal(excess.size, 101); assert(excess.docs.every((doc) => doc.data().status === 'requested'));
  await excess.docs[0].ref.delete();
  const atLimit = await preview(overLimit);
  assert.equal(atLimit.bookingCount, 100);
  const limitReceipt = await call('cancelTrip', driver, intent(overLimit, atLimit.revision));
  assert.equal(limitReceipt.bookingCount, 100);
  const limitBookings = await db.collection('bookings').where('tripId', '==', overLimit).get();
  assert.equal(limitBookings.size, 100); assert(limitBookings.docs.every((doc) => doc.data().status === 'cancelled'));
  assert.equal((await db.collection('notifications').where('sourceId', '==', overLimit).get()).size, 1);

  const races = await checkTripCancellationRaces({ driver, parent, outsider, create, preview, intent, book });
  return { method: 'authenticated-local-callable-http-with-independent-persisted-checks', tripId,
    receipt, savedTrip: { status: savedTrip.status, seatsAvailable: savedTrip.seatsAvailable,
      seatsTotal: savedTrip.seatsTotal, cancelledByUserId: savedTrip.cancelledByUserId,
      cancelledAt: savedTrip.cancelledAt.toDate().toISOString() },
    reservations: await Promise.all(receipt.bookingIds.map(async (bookingId) => {
      const booking = await document('bookings', bookingId);
      return { bookingId, status: booking.status, refundStatus: booking.refundStatus,
        cancelledAt: booking.cancelledAt.toDate().toISOString(), cancelledByUserId: booking.cancelledByUserId };
    })),
    notifications: notes.docs.map((doc) => ({ id: doc.id, userId: doc.data().userId, bookingIds: doc.data().bookingIds })),
    bookingIds: receipt.bookingIds, bookingCount: 3, notificationCount: 2, refundPendingCount: 1,
    seatsInitiallyOffered: 3, seatsAfterApproval: 1, seatsAfterCancellation: 3,
    repeatedAndConcurrentRequestsIdempotent: true, closedReservationUnchanged: true,
    staleBookingApprovalPaymentRejected: true, malformedMetadataRejected: true, resourceLimitRejectedAtomically: true,
    hundredReservationsCancelledAtomically: true,
    cancelledReservationsVisibleToParents: true, parentInboxNotificationsVerified: true, races,
    nativeUi: false, livePayment: false, refundIssued: false, productionDeployed: false };
}
