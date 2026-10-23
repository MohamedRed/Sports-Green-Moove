import assert from 'node:assert/strict';

export const ridePhonePhases = ['prepared', 'started', 'picked-up', 'dropped-off', 'stable', 'completed', 'reviewed'];

export function verifyRidePhoneCheckpoint(phase, state, fixture) {
  assert(ridePhonePhases.includes(phase));
  const { trip, booking, rides, audit, co2, rewards, ratings } = state;
  assert.equal(trip.id, fixture.tripId); assert.equal(booking.id, fixture.bookingId);
  assert.equal(trip.driverUserId, fixture.driverUid); assert.equal(trip.priceCents, 0);
  assert.equal(trip.distanceKm, undefined, 'This trial has no confirmed travelled distance');
  assert.equal(booking.tripId, trip.id); assert.equal(booking.childId, fixture.childId);
  assert.equal(booking.parentUserId, fixture.parentUid); assert.equal(booking.driverUserId, fixture.driverUid);
  assert.equal(booking.seats, 2);
  for (const rows of [rides, audit, co2, rewards, ratings]) assert(Array.isArray(rows));
  const ended = ['completed', 'reviewed'].includes(phase);
  assert.equal(booking.status, ended ? 'completed' : 'approved');
  assert.equal(trip.status, ended ? 'completed' : 'published');
  assert.equal(rides.length, phase === 'prepared' ? 0 : 1);
  const picked = !['prepared', 'started'].includes(phase), dropped = !['prepared', 'started', 'picked-up'].includes(phase);
  const expectedAudit = Number(picked) + Number(dropped);
  assert.equal(audit.length, expectedAudit);
  if (phase !== 'prepared') {
    const ride = rides[0];
    assert.equal(ride.tripId, trip.id); assert.equal(ride.driverUserId, fixture.driverUid);
    assert.deepEqual(ride.bookingIds, [booking.id]); assert.equal(ride.passengers.length, 1);
    assert.equal(ride.status, ended ? 'completed' : 'active');
    const passenger = ride.passengers[0];
    assert.equal(passenger.bookingId, booking.id); assert.equal(passenger.childId, fixture.childId);
    assert.equal(passenger.pickupStatus, picked ? 'pickedUp' : 'pending');
    assert.equal(passenger.dropoffStatus, dropped ? 'droppedOff' : 'pending');
    assert.equal(booking.pickupStatus, picked ? 'pickedUp' : undefined);
    assert.equal(booking.dropoffStatus, dropped ? 'droppedOff' : undefined);
    assert.equal(audit.filter(row => row.action === 'pickup').length, Number(picked));
    assert.equal(audit.filter(row => row.action === 'dropoff').length, Number(dropped));
    for (const row of audit) { assert.equal(row.bookingId, booking.id); assert.equal(row.childId, fixture.childId); }
    assert.equal(co2.length, Number(ended)); assert.equal(rewards.length, 0);
    for (const rows of [co2, rewards]) {
      for (const row of rows) { assert.equal(row.rideSessionId, ride.id); assert.equal(row.userId, fixture.driverUid); }
    }
    for (const row of co2) assert.equal(row.co2SavedKg, 0, 'This fixture has no confirmed travelled distance');
    assert.equal(ratings.length, Number(phase === 'reviewed'));
    for (const rating of ratings) {
      assert.equal(rating.rideSessionId, ride.id); assert.equal(rating.score, 5);
      assert.equal(rating.authorUserId, fixture.parentUid); assert.equal(rating.ratedUserId, fixture.driverUid);
    }
  } else for (const rows of [co2, rewards, ratings]) assert.equal(rows.length, 0);
  return { phase, rideCount: rides.length, pickupCount: Number(picked), dropoffCount: Number(dropped),
    auditCount: audit.length, co2Entries: co2.length, rewardEntries: rewards.length, ratingCount: ratings.length,
    phoneUiVerifiedByController: false, physicalTrackingAccepted: false, productionWrites: false };
}
