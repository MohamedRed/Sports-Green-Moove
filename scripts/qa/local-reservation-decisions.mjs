import assert from 'node:assert/strict';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { viewedBooking, auth, db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';

export async function checkReservationDecisions() {
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  const outsider = await signIn('outsider@example.test');
  await auth.createUser({ uid: 'sgm-qa-other-driver', email: 'other-driver@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-other-driver', { roleKeys: ['driver'] });
  const otherDriver = await signIn('other-driver@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Local reservation decisions QA' });
  const request = async (seats = 1) => call('requestBooking', parent, await viewedBooking(parent, { tripId, childId: 'sgm-qa-child-lina', seats }));
  const list = (actor, role) => call('listReservations', actor, { role });
  const pending = await request(2);
  assert.deepEqual((await list(parent, 'parent')).items.find((b) => b.bookingId === pending.bookingId)?.allowedActions, ['cancel']);
  assert.deepEqual((await list(driver, 'driver')).items.find((b) => b.bookingId === pending.bookingId)?.allowedActions, ['approve', 'decline']);
  assert(!(await list(outsider, 'parent')).items.some((b) => b.bookingId === pending.bookingId));
  await denied('listReservations', null, { role: 'parent' }, 'UNAUTHENTICATED');
  await denied('listReservations', parent, { role: 'driver' }, 'PERMISSION_DENIED');
  for (const actor of [parent, otherDriver]) await denied('declineBooking', actor, { bookingId: pending.bookingId }, 'PERMISSION_DENIED');
  await denied('declineBooking', driver, { bookingId: 'bad/id' }, 'INVALID_ARGUMENT');
  await call('declineBooking', driver, { bookingId: pending.bookingId });
  assert.equal((await document('bookings', pending.bookingId)).status, 'declined');
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  for (const [name, actor] of [['declineBooking', driver], ['approveBooking', driver], ['cancelBooking', parent]]) {
    await denied(name, actor, { bookingId: pending.bookingId }, 'FAILED_PRECONDITION');
  }
  const notes = await db.collection('notifications').where('sourceId', '==', pending.bookingId).where('type', '==', 'bookingDeclined').get();
  assert.equal(notes.size, 1);
  assert.equal(notes.docs[0].get('userId'), parent.uid);
  const declined = (await list(parent, 'parent')).items.find((b) => b.bookingId === pending.bookingId);
  assert.equal(declined?.status, 'declined');
  assert.deepEqual(declined.allowedActions, []);

  const cancellable = await request(2);
  await call('approveBooking', driver, { bookingId: cancellable.bookingId });
  assert.equal((await document('trips', tripId)).seatsAvailable, 2);
  const cancellations = await Promise.allSettled([1, 2].map(() => call('cancelBooking', parent, { bookingId: cancellable.bookingId })));
  assert.equal(cancellations.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(cancellations.find((r) => r.status === 'rejected')?.reason.code, 'FAILED_PRECONDITION');
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  assert.equal((await document('bookings', cancellable.bookingId)).refundStatus, 'notRequired');
  const unapproved = await request();
  await call('cancelBooking', parent, { bookingId: unapproved.bookingId });
  assert.equal((await document('trips', tripId)).seatsAvailable, 4);
  const race = await request();
  const decisions = await Promise.allSettled(['approveBooking', 'declineBooking'].map((name) => call(name, driver, { bookingId: race.bookingId })));
  assert.equal(decisions.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(decisions.find((r) => r.status === 'rejected')?.reason.code, 'FAILED_PRECONDITION');
  const status = (await document('bookings', race.bookingId)).status;
  assert(['approved', 'declined'].includes(status));
  assert.equal((await document('trips', tripId)).seatsAvailable, status === 'approved' ? 3 : 4);
  if (status === 'approved') await call('cancelBooking', parent, { bookingId: race.bookingId });

  const batch = db.batch();
  const historyIds = Array.from({ length: 25 }, (_, i) => `sgm-qa-reservation-history-${i.toString().padStart(2, '0')}`);
  for (const id of historyIds) batch.set(db.collection('bookings').doc(id), { tripId, parentUserId: parent.uid,
    requesterUserId: parent.uid, driverUserId: driver.uid, seats: 1, status: 'cancelled', createdAt: Timestamp.fromMillis(1_000) });
  batch.set(db.collection('bookings').doc('sgm-qa-reservation-owner-precedence'), { tripId, parentUserId: outsider.uid,
    requesterUserId: parent.uid, driverUserId: driver.uid, seats: 1, status: 'requested', createdAt: Timestamp.fromMillis(2_000) });
  await batch.commit();
  for (const [actor, role] of [[parent, 'parent'], [driver, 'driver']]) {
    const seen = new Set();
    let cursor;
    let pages = 0;
    do {
      const page = await call('listReservations', actor, { role, ...(cursor ? { cursor } : {}) });
      assert(page.items.length <= 20);
      for (const item of page.items) {
        assert(!seen.has(item.bookingId));
        seen.add(item.bookingId);
        if (role === 'parent') assert.equal(item.parentUserId, parent.uid);
      }
      cursor = page.nextCursor;
      if (cursor) await denied('listReservations', outsider, { role: 'parent', cursor }, 'PERMISSION_DENIED');
      assert(++pages < 20, 'Reservation pagination must finish');
    } while (cursor);
    assert(historyIds.every((id) => seen.has(id)));
    if (role === 'parent') assert(!seen.has('sgm-qa-reservation-owner-precedence'));
  }
  await denied('listReservations', parent, { role: 'parent', cursor: 'broken' }, 'INVALID_ARGUMENT');

  const passenger = await request();
  const late = await request();
  await call('approveBooking', driver, { bookingId: passenger.bookingId });
  const active = await call('startRide', driver, { tripId, bookingIds: [passenger.bookingId], guardianConsent: true, childTrackingEnabled: true });
  await denied('declineBooking', driver, { bookingId: late.bookingId }, 'FAILED_PRECONDITION');
  await denied('cancelBooking', parent, { bookingId: passenger.bookingId }, 'FAILED_PRECONDITION');
  assert(active.ride?.rideSessionId, 'The started ride snapshot must identify its session');
  const rideRef = db.collection('rideSessions').doc(active.ride.rideSessionId);
  await rideRef.update({ bookingIds: FieldValue.delete() });
  await denied('cancelBooking', parent, { bookingId: passenger.bookingId }, 'FAILED_PRECONDITION');
  await rideRef.update({ bookingIds: [passenger.bookingId] });
  assert.deepEqual((await list(parent, 'parent')).items.find((b) => b.bookingId === passenger.bookingId)?.allowedActions, []);
  assert.equal((await document('trips', tripId)).seatsAvailable, 3);
  return { declinedSeatsBefore: 4, declinedSeatsAfter: 4, declineNotificationCount: 1,
    cancellationSeatsBefore: 2, cancellationSeatsAfter: 4, concurrentCancellationWinners: 1,
    concurrentDecisionWinners: 1, historicalBookingsPerRole: 25, activePassengerCancellationRejected: true,
    malformedActiveRideRejected: true, livePayment: false };
}
