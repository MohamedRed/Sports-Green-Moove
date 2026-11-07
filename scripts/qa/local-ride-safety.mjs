import assert from 'node:assert/strict';
import { viewedBooking, db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';

export async function checkRidePassengerSafety() {
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  const childId = 'sgm-qa-child-lina';
  const { tripId } = await call('createTrip', driver, tripInput());
  const bookings = [];
  for (const input of [{ childId }, { childId }, {}]) {
    const booking = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1, ...input }));
    if (bookings.length < 2) await call('approveBooking', driver, { bookingId: booking.bookingId });
    bookings.push(booking.bookingId);
  }
  await denied('startRide', driver, { tripId, bookingIds: [bookings[0], bookings[0]] }, 'INVALID_ARGUMENT');
  const starts = await Promise.all([0, 1].map(() => call('startRide', driver, { tripId, bookingIds: bookings.slice(0, 2) })));
  const { ride } = starts[0];
  assert.equal(starts[1].ride.rideSessionId, ride.rideSessionId, 'Concurrent starts must refer to the same ride');
  assert.equal((await db.collection('rideSessions').where('tripId', '==', tripId).get()).size, 1);
  assert.equal((await call('startRide', driver, { tripId })).ride.rideSessionId, ride.rideSessionId);
  await denied('startRide', driver, { tripId, bookingIds: [bookings[0]] }, 'FAILED_PRECONDITION');
  await denied('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }), 'FAILED_PRECONDITION');
  await denied('approveBooking', driver, { bookingId: bookings[2] }, 'FAILED_PRECONDITION');
  await denied('cancelBooking', parent, { bookingId: bookings[0] }, 'FAILED_PRECONDITION');
  const target = { rideSessionId: ride.rideSessionId, bookingId: bookings[0], childId };
  await denied('markPickup', parent, target, 'PERMISSION_DENIED');
  await denied('markPickup', driver, { ...target, childId: 'sgm-qa-wrong-child' }, 'FAILED_PRECONDITION');
  await denied('markPickup', driver, { ...target, bookingId: bookings[2], childId: bookings[2] }, 'FAILED_PRECONDITION');
  await denied('markDropoff', driver, target, 'FAILED_PRECONDITION');
  await denied('endRide', driver, { rideSessionId: ride.rideSessionId, distanceMeters: 28600, passengersSharing: 2 }, 'FAILED_PRECONDITION');
  const before = await document('rideSessions', ride.rideSessionId);
  assert.equal(before.status, 'active');
  assert.equal((await document('trips', tripId)).status, 'published');
  for (const collection of ['co2Ledger', 'rewardLedger']) {
    assert.equal((await db.collection(collection).where('rideSessionId', '==', ride.rideSessionId).get()).size, 0);
  }
  assert(before.passengers.every((passenger) => passenger.pickupStatus === 'pending' && passenger.dropoffStatus === 'pending'));
  const audit = db.collection('rideSessions').doc(ride.rideSessionId).collection('auditEvents');
  assert.equal((await audit.get()).size, 0, 'Rejected confirmations must not create audit events');
  await call('markPickup', driver, target);
  const { ride: parentView } = await call('getActiveRide', parent);
  assert.equal(parentView.passengers.find((p) => p.bookingId === bookings[0]).pickupStatus, 'pickedUp');
  assert.equal(parentView.passengers.find((p) => p.bookingId === bookings[1]).pickupStatus, 'pending',
    'A confirmation must affect only the matching booking, even for the same child');
  const firstAudit = (await audit.get()).docs.map((entry) => entry.data());
  await denied('markPickup', driver, target, 'FAILED_PRECONDITION');
  assert.deepEqual((await audit.get()).docs.map((entry) => entry.data()), firstAudit,
    'A repeated confirmation must not replace its original audit record');
  await call('markDropoff', driver, target);
  await denied('endRide', driver, { rideSessionId: ride.rideSessionId, distanceMeters: 28600, passengersSharing: 2 }, 'FAILED_PRECONDITION');
  await denied('markDropoff', driver, target, 'FAILED_PRECONDITION');
  const other = { ...target, bookingId: bookings[1] };
  await call('markPickup', driver, other);
  await call('markDropoff', driver, other);
  assert.equal((await audit.get()).size, 4);
  await call('endRide', driver, { rideSessionId: ride.rideSessionId, distanceMeters: 28600, passengersSharing: 2 });
  assert.equal((await document('trips', tripId)).status, 'completed');
  await denied('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }), 'FAILED_PRECONDITION');
  await denied('startRide', driver, { tripId, bookingIds: [] }, 'FAILED_PRECONDITION');
  await call('cancelBooking', parent, { bookingId: bookings[2] });

  const { tripId: emptyTripId } = await call('createTrip', driver, tripInput());
  const empty = await call('startRide', driver, { tripId: emptyTripId, bookingIds: [] });
  const detached = { bookingId: 'sgm-qa-detached-approved' };
  await db.collection('bookings').doc(detached.bookingId).set({ tripId: emptyTripId,
    driverUserId: driver.uid, parentUserId: parent.uid, status: 'approved', seats: 1 });
  await denied('markPickup', driver, { rideSessionId: empty.ride.rideSessionId,
    bookingId: detached.bookingId, childId: detached.bookingId }, 'FAILED_PRECONDITION');
  assert.equal((await db.collection('rideSessions').doc(empty.ride.rideSessionId).collection('auditEvents').get()).size, 0);
  const { tripId: legacyTripId } = await call('createTrip', driver, tripInput());
  await db.collection('rideSessions').doc('sgm-qa-legacy-active').set({ tripId: legacyTripId,
    driverUserId: driver.uid, status: 'active', bookingIds: [], passengers: [], startedAt: new Date() });
  await denied('startRide', driver, { tripId: legacyTripId, bookingIds: [] }, 'FAILED_PRECONDITION');
}
