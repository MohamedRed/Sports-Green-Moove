import assert from 'node:assert/strict';
import { auth, db, call, denied, document, signIn } from './local-flow-client.mjs';

export async function checkTripCancellationRaces({ driver, parent, outsider, create, preview, intent, book }) {
  await auth.createUser({ uid: 'sgm-qa-cancel-other-driver', email: 'cancel-other-driver@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-cancel-other-driver', { roleKeys: ['driver'] });
  const otherDriver = await signIn('cancel-other-driver@example.test');
  const foreign = await create();
  const foreignRequest = intent(foreign, (await preview(foreign)).revision);
  for (const name of ['getTripCancellation', 'cancelTrip']) await denied(name, otherDriver,
    name === 'cancelTrip' ? foreignRequest : { tripId: foreign }, 'PERMISSION_DENIED');
  await auth.createUser({ uid: 'sgm-qa-cancellation-admin', email: 'cancellation-admin@example.test', password: process.env.SGM_QA_PASSWORD });
  await auth.setCustomUserClaims('sgm-qa-cancellation-admin', { roleKeys: ['admin'] });
  const admin = await signIn('cancellation-admin@example.test');
  const adminPreview = await call('getTripCancellation', admin, { tripId: foreign });
  const adminReceipt = await call('cancelTrip', admin, intent(foreign, adminPreview.revision));
  assert.equal(adminReceipt.actorUserId, admin.uid);
  assert.equal((await document('trips', foreign)).cancelledByUserId, admin.uid);
  assert.deepEqual(await preview(foreign), adminReceipt);
  for (const status of ['completed', 'draft', 'cancelled']) {
    const id = await create();
    await db.collection('trips').doc(id).update({ status });
    await denied('getTripCancellation', driver, { tripId: id }, 'FAILED_PRECONDITION');
  }
  const pointer = await create();
  await db.collection('trips').doc(pointer).update({ activeRideSessionId: 'missing-local-ride' });
  await denied('getTripCancellation', driver, { tripId: pointer }, 'FAILED_PRECONDITION');
  const orphan = await create();
  await db.collection('rideSessions').add({ tripId: orphan, driverUserId: driver.uid, status: 'active' });
  await denied('getTripCancellation', driver, { tripId: orphan }, 'FAILED_PRECONDITION');

  const outcomes = [];
  for (const action of ['requestBooking', 'approveBooking', 'startRide']) {
    const tripId = await create();
    const bookingId = action === 'approveBooking' ? await book(parent, tripId) : undefined;
    const request = intent(tripId, (await preview(tripId)).revision);
    const operation = action === 'requestBooking' ? call(action, outsider, { tripId, seats: 1 })
      : action === 'approveBooking' ? call(action, driver, { bookingId }) : call(action, driver, { tripId });
    const results = await Promise.allSettled([operation, call('cancelTrip', driver, request)]);
    assert(results.some((item) => item.status === 'fulfilled'));
    for (const result of results) if (result.status === 'rejected') assert(['ABORTED', 'FAILED_PRECONDITION'].includes(result.reason.code));
    let trip = await document('trips', tripId);
    if (trip.status !== 'cancelled' && !trip.activeRideSessionId) {
      await call('cancelTrip', driver, intent(tripId, (await preview(tripId)).revision));
      trip = await document('trips', tripId);
    }
    const active = await db.collection('bookings').where('tripId', '==', tripId).where('status', 'in', ['requested', 'approved']).get();
    if (trip.status === 'cancelled') {
      assert.equal(active.size, 0); assert.equal(trip.activeRideSessionId, undefined);
      assert.equal(trip.seatsAvailable, 4);
    } else {
      assert.equal(action, 'startRide'); assert(trip.activeRideSessionId);
      assert.equal((await document('rideSessions', trip.activeRideSessionId)).status, 'active');
      assert.equal((await db.collection('tripCancellations').doc(tripId).get()).exists, false);
      await denied('getTripCancellation', driver, { tripId }, 'FAILED_PRECONDITION');
    }
    outcomes.push({ action, tripStatus: trip.status, activeBookingCount: active.size,
      results: results.map((result) => result.status === 'fulfilled' ? 'confirmed' : result.reason.code), consistent: true });
  }
  return { crossDriverDenied: true, explicitAdminCancellationRecorded: true,
    closedTripsRejected: true, activeRideAndOrphanRejected: true, outcomes };
}
