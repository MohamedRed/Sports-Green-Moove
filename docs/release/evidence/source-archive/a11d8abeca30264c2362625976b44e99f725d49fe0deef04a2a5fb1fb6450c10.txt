import assert from 'node:assert/strict';

export const reviewNetworkPhases = ['parent-ready', 'offline-sending', 'offline-failed', 'online-before-retry',
  'parent-rated', 'parent-restored', 'driver-summary', 'signed-out'];

export function verifyReviewNetworkState(phase, state, fixture) {
  const index = reviewNetworkPhases.indexOf(phase); assert(index >= 0);
  const rated = index >= 4, expected = fixture.rides.filter(row => !rated || row.id !== fixture.selectedRideId);
  assert.deepEqual(state.parent.map(row => row.rideSessionId).sort(), expected.map(row => row.id).sort());
  assert.deepEqual(state.driver.map(row => row.rideSessionId).sort(), fixture.rides.map(row => row.id).sort());
  for (const [rows, author, target] of [[state.parent, fixture.parentUid, fixture.driverUid], [state.driver, fixture.driverUid, fixture.parentUid]]) {
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
    for (const row of rows) {
      const ride = fixture.rides.find(ride => ride.id === row.rideSessionId); assert(ride);
      assert.equal(row.id, `${ride.id}_${author}_${target}`); assert.equal(row.ratedUserId, target);
      assert.deepEqual(row.tripContext, {tripId: ride.tripId, title: 'Entraînement U12',
        departureAt: ride.departureAt, departureLabel: ride.departureLabel});
    }
  }
  assert.equal(state.ratings.length, Number(rated));
  if (rated) {
    const row = state.ratings[0];
    assert.equal(row.id, `${fixture.selectedRideId}_${fixture.parentUid}_${fixture.driverUid}`);
    assert.equal(row.rideSessionId, fixture.selectedRideId); assert.equal(row.authorUserId, fixture.parentUid);
    assert.equal(row.ratedUserId, fixture.driverUid); assert.equal(row.score, 5); assert.equal(row.comment, null);
  }
  assert.deepEqual(state.parentSummary, {userId: fixture.parentUid, count: 0, average: null});
  assert.deepEqual(state.driverSummary, {userId: fixture.driverUid, count: Number(rated), average: rated ? 5 : null});
  return {phase, status: 'passed', parentRequests: state.parent.length, driverRequests: state.driver.length,
    ratingCount: state.ratings.length, exactTripAndTargetsPreserved: true,
    physicalNetworkLossProvenByObserver: false, phoneUiProvenByObserver: false, processRestartProvenByObserver: false};
}
