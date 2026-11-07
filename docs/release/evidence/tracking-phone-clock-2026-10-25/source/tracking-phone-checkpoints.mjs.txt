import assert from 'node:assert/strict';

export const trackingPhonePhases = ['prepared', 'foreground-first', 'foreground-moved', 'background-moved',
  'foreground-returned', 'signed-out', 'signed-out-stable'];
export const trackingPhonePoints = {
  first: {lat: 50.7167, lng: 4.6167}, moved: {lat: 50.7177, lng: 4.6177},
  background: {lat: 50.7187, lng: 4.6187}, afterSignOut: {lat: 50.7197, lng: 4.6197},
};
const cleanTrip = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['activeRideSessionId', 'updatedAt'].includes(key)));

export function verifyTrackingPhoneCheckpoint(phase, state, baseline, fixture, previous) {
  assert(trackingPhonePhases.includes(phase));
  const rides = (state.documents.rideSessions ?? []).filter(row => row.data.tripId === fixture.tripId);
  const active = phase !== 'prepared'; assert.equal(rides.length, Number(active));
  const ride = rides[0], trip = state.documents.trips.find(row => row.id === fixture.tripId)?.data;
  const original = baseline.documents.trips.find(row => row.id === fixture.tripId)?.data;
  assert(trip && original); assert.deepEqual(cleanTrip(trip), cleanTrip(original));
  assert.deepEqual(state.documents.bookings.find(row => row.id === fixture.bookingId),
    baseline.documents.bookings.find(row => row.id === fixture.bookingId));
  let vehicle;
  if (active) {
    assert.equal(ride.data.status, 'active'); assert.equal(ride.data.driverUserId, fixture.driverUid);
    assert.deepEqual(ride.data.bookingIds, [fixture.bookingId]); assert.deepEqual(ride.data.participantUserIds, [fixture.parentUid]);
    assert.equal(trip.activeRideSessionId, ride.id);
    const live = state.liveTrips?.[ride.id]; assert(live); assert.equal(live.meta.status, 'active');
    assert.equal(live.meta.driverUserId, fixture.driverUid); assert.equal(live.meta.tripId, fixture.tripId);
    assert.equal(live.children, undefined, 'This trial does not inject or accept child GPS');
    vehicle = live.vehicle; assert(vehicle); assert.equal(vehicle.source, 'nativeFallback');
    assert.equal(vehicle.userId, fixture.driverUid);
    assert.equal(vehicle.rideSessionId, ride.id); assert.equal(vehicle.role, 'driver');
    for (const key of ['lat', 'lng', 'capturedAt', 'uploadedAt']) assert(Number.isFinite(vehicle[key]));
    const point = phase === 'foreground-first' ? trackingPhonePoints.first
      : phase === 'foreground-moved' ? trackingPhonePoints.moved : trackingPhonePoints.background;
    assert(Math.abs(vehicle.lat - point.lat) < 0.0001 && Math.abs(vehicle.lng - point.lng) < 0.0001,
      'Only the expected simulated phone position is accepted');
    if (previous && ['foreground-moved', 'background-moved'].includes(phase)) {
      const old = previous.liveTrips?.[ride.id]?.vehicle; assert(old);
      assert(vehicle.capturedAt > old.capturedAt && vehicle.uploadedAt > old.uploadedAt);
    }
    if (phase === 'signed-out-stable') assert.deepEqual(state.liveTrips[ride.id], previous.liveTrips[ride.id]);
  } else assert.equal(trip.activeRideSessionId, undefined);
  const before = structuredClone(baseline), after = structuredClone(state);
  for (const value of [before, after]) {
    const ownTrip = value.documents.trips.find(row => row.id === fixture.tripId); ownTrip.data = cleanTrip(ownTrip.data);
    for (const uid of [fixture.parentUid, fixture.driverUid]) {
      const user = value.documents.users.find(row => row.id === uid); if (user) delete user.data.updatedAt;
    }
    value.documents.rideSessions = (value.documents.rideSessions ?? []).filter(row => row.id !== ride?.id);
    for (const [key, rows] of Object.entries(value.documents)) if (!rows.length) delete value.documents[key];
    if (ride && value.liveTrips) {delete value.liveTrips[ride.id]; if (!Object.keys(value.liveTrips).length) value.liveTrips = null;}
  }
  assert.deepEqual(after, before, 'All unrelated root records, bookings, claims and live trips stay unchanged');
  return {phase, rideId: ride?.id ?? null, vehicle: vehicle ?? null, allOtherRootRecordsAndClaimsUnchanged: true,
    productionWrites: false, simulatedLocations: true, childTrackingProven: false, realMovementProven: false,
    phoneUiProven: false, paymentExercised: false, routeProviderRequests: 0};
}
