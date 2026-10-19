import assert from 'node:assert/strict';
import { getDatabase } from 'firebase-admin/database';
import { auth, call, db, document, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';

const names = ['trips', 'bookings', 'rideSessions', 'notifications', 'co2Ledger', 'rewardLedger'];
async function state() {
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name,
    (await db.collection(name).orderBy('__name__').get()).docs.map((row) => ({ id: row.id, ...row.data() }))])));
}
export async function seedRideObservationFixture() {
  const before = await state();
  const claims = (await auth.getUser('sgm-qa-driver')).customClaims;
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet suivi continu QA', priceCents: 0 });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, {
    tripId, seats: 1, childId: 'sgm-qa-child-lina',
  }));
  await call('approveBooking', driver, { bookingId });
  const { ride } = await call('startRide', driver, { tripId, bookingIds: [bookingId] });
  return { before, claims, tripId, bookingId, rideSessionId: ride.rideSessionId, childId: 'sgm-qa-child-lina' };
}
export async function verifyRideObservationFixture(fixture, marker) {
  assert.equal(marker.rideSessionId, fixture.rideSessionId); assert.equal(marker.bookingId, fixture.bookingId);
  assert.equal(marker.childId, fixture.childId);
  const ride = await document('rideSessions', fixture.rideSessionId);
  assert.equal(ride.status, 'completed'); assert.equal(ride.driverUserId, 'sgm-qa-driver');
  assert.deepEqual(ride.bookingIds, [fixture.bookingId]);
  assert.equal(ride.passengers[0].pickupStatus, 'pickedUp'); assert.equal(ride.passengers[0].dropoffStatus, 'droppedOff');
  assert.equal((await document('trips', fixture.tripId)).status, 'completed');
  assert.equal((await document('bookings', fixture.bookingId)).status, 'completed');
  const audit = (await db.collection('rideSessions').doc(fixture.rideSessionId).collection('auditEvents').get()).docs;
  assert.equal(audit.length, 2); assert.deepEqual(audit.map((row) => row.get('action')).sort(), ['dropoff', 'pickup']);
  const ledger = await db.collection('co2Ledger').where('sourceId', '==', fixture.rideSessionId).get();
  assert.equal(ledger.size, 1); assert.equal(ledger.docs[0].get('distanceMeters'), 0);
  const live = (await getDatabase().ref(`liveTrips/${fixture.rideSessionId}`).get()).val();
  assert.equal(live.meta.status, 'completed'); assert.equal(live.vehicle.userId, 'sgm-qa-driver');
  assert.equal(live.vehicle.source, 'nativeFallback');
  assert.deepEqual((await auth.getUser('sgm-qa-driver')).customClaims, fixture.claims);
  return { auditEventCount: 2, bookingCount: 1, co2LedgerCount: 1, completionVerified: true, claimsUnchanged: true };
}
export async function cleanupRideObservationFixture(fixture) {
  const batch = db.batch();
  for (const collection of ['notifications', 'co2Ledger', 'rewardLedger']) {
    for (const sourceId of [fixture.tripId, fixture.bookingId, fixture.rideSessionId]) {
      for (const row of (await db.collection(collection).where('sourceId', '==', sourceId).get()).docs) batch.delete(row.ref);
    }
  }
  for (const row of (await db.collection('rideSessions').doc(fixture.rideSessionId).collection('auditEvents').get()).docs) batch.delete(row.ref);
  batch.delete(db.collection('rideSessions').doc(fixture.rideSessionId));
  batch.delete(db.collection('bookings').doc(fixture.bookingId)); batch.delete(db.collection('trips').doc(fixture.tripId));
  await batch.commit(); await getDatabase().ref(`liveTrips/${fixture.rideSessionId}`).remove();
  assert.deepEqual(await state(), fixture.before, 'Only this isolated trial may change existing flow records');
}
