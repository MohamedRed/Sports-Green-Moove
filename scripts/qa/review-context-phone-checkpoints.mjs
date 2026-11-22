import assert from 'node:assert/strict';

export const contextPhonePhases = ['driver-context', 'driver-rated', 'driver-returned', 'parent-first-page',
  'parent-more', 'parent-rated', 'parent-restored', 'signed-out'];
export function verifyContextPhoneState(phase, state, fixture) {
  const index = contextPhonePhases.indexOf(phase); assert(index >= 0);
  const driverRated = index > 0, parentRated = index >= 5;
  assert.equal(state.driver.length, driverRated ? 0 : 1);
  assert.equal(state.parent.length, parentRated ? 31 : 32);
  assert.equal(state.ratings.length, 31 + Number(driverRated) + Number(parentRated));
  assert.deepEqual(state.parent.map(row => row.rideSessionId).sort(),
    [...fixture.rides.filter(ride => !parentRated || ride !== fixture.rides.at(-1)), fixture.missingRide].sort());
  const expectedContext = (ride, details) => ({tripId: fixture.tripIds[ride], ...details});
  for (const row of [...state.driver, ...state.parent]) {
    assert.equal(row.id, `${row.rideSessionId}_${row.ratedUserId === fixture.driverUid ? fixture.parentUid : fixture.driverUid}_${row.ratedUserId}`);
    if (row.rideSessionId === fixture.missingRide) assert.equal(row.tripContext, null);
    else {assert(fixture.contexts[row.rideSessionId]); assert.deepEqual(row.tripContext, expectedContext(row.rideSessionId, fixture.contexts[row.rideSessionId]));}
  }
  assert.equal(state.parent.filter(row => row.tripContext === null).length, 1);
  assert(state.parent.every(row => row.ratedUserId === fixture.driverUid));
  assert.equal(new Set(state.parent.map(row => row.id)).size, state.parent.length);
  assert.equal(state.parent.some(row => row.rideSessionId === fixture.rides.at(-1)), !parentRated);
  assert(state.parent.some(row => row.rideSessionId === fixture.rides[0]));
  if (!driverRated) {assert.equal(state.driver[0].rideSessionId, fixture.rides.at(-1)); assert.equal(state.driver[0].ratedUserId, fixture.parentUid);}
  for (const [present, author, target] of [[driverRated, fixture.driverUid, fixture.parentUid], [parentRated, fixture.parentUid, fixture.driverUid]]) {
    const id = `${fixture.rides.at(-1)}_${author}_${target}`, rating = state.ratings.find(row => row.id === id);
    assert.equal(Boolean(rating), present);
    if (rating) {assert.equal(rating.rideSessionId, fixture.rides.at(-1)); assert.equal(rating.authorUserId, author); assert.equal(rating.ratedUserId, target); assert.equal(rating.score, 5);}
  }
  return {phase, status: 'passed', driverRequests: state.driver.length, parentRequests: state.parent.length,
    unavailableParentRequests: 1, ratingCount: state.ratings.length, exactReviewTargetsPreserved: true,
    phoneUiProvenByThisObserver: false, processRestartProven: false};
}
