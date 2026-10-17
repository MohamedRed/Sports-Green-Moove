import assert from 'node:assert/strict';
import { db } from './local-flow-client.mjs';

export async function verifyLocalRideUi() {
  const rides = await db.collection('rideSessions').get();
  assert.equal(rides.size, 1, 'UI flow must create one real local ride');
  const snapshot = rides.docs[0];
  const ride = snapshot.data();
  assert.equal(ride.status, 'completed');
  assert.equal(ride.driverUserId, 'sgm-qa-driver');
  assert.deepEqual(new Set(ride.bookingIds), new Set(['sgm-qa-booking-requested', 'sgm-qa-booking-approved']));
  assert(ride.passengers.every((p) => p.pickupStatus === 'pickedUp' && p.dropoffStatus === 'droppedOff'));
  const trip = await db.collection('trips').doc(ride.tripId).get();
  assert.equal(trip.data().status, 'completed');
  for (const id of ride.bookingIds) {
    assert.equal((await db.collection('bookings').doc(id).get()).data().status, 'completed');
  }
  const audit = await snapshot.ref.collection('auditEvents').get();
  assert.equal(audit.size, 4);
  assert.equal(audit.docs.filter((doc) => doc.data().action === 'pickup').length, 2);
  assert.equal(audit.docs.filter((doc) => doc.data().action === 'dropoff').length, 2);
  for (const collection of ['co2Ledger', 'rewardLedger']) {
    const entries = await db.collection(collection).where('rideSessionId', '==', snapshot.id).get();
    assert.equal(entries.size, 1, `${collection}: one UI completion record required`);
    assert.equal(entries.docs[0].data().userId, 'sgm-qa-driver');
  }
  const ratings = await db.collection('ratings').where('rideSessionId', '==', snapshot.id).get();
  assert.equal(ratings.size, 1);
  assert.equal(ratings.docs[0].data().score, 5);
  return { rideSessionId: snapshot.id, bookingCount: ride.bookingIds.length, auditEventCount: audit.size, ratingCount: ratings.size };
}
