import assert from 'node:assert/strict';

export const reviewPhonePhases = ['history-hidden', 'new-prompt', 'driver-rated', 'driver-returned', 'parent-prompt', 'parent-rated', 'signed-out'];
export function verifyReviewPhoneCheckpoint(phase, state, fixture) {
  assert(reviewPhonePhases.includes(phase));
  const index = reviewPhonePhases.indexOf(phase), driverRated = index >= 2, parentRated = index >= 5;
  const expected = 104 + Number(driverRated) + Number(parentRated);
  assert.equal(state.ratings.length, expected);
  const id = (ride, author, target) => `${ride}_${author}_${target}`;
  const originals = new Map(fixture.rides.flatMap(ride => fixture.peers.map(peer => [id(ride, fixture.driverUid, peer), {ride, peer}])));
  assert.equal(originals.size, 104);
  for (const row of state.ratings.filter(row => originals.has(row.id))) {
    const expected = originals.get(row.id); assert(expected);
    assert.equal(row.score, 4); assert.equal(row.authorUserId, fixture.driverUid);
    assert.equal(row.rideSessionId, expected.ride); assert.equal(row.ratedUserId, expected.peer); originals.delete(row.id);
  }
  assert.equal(originals.size, 0, 'Every original rating must remain stored');
  for (const [present, ride, author, target] of [[driverRated, fixture.freshRide, fixture.driverUid, fixture.parentUid],
    [parentRated, fixture.rides[0], fixture.parentUid, fixture.driverUid]]) {
    const row = state.ratings.find(row => row.id === id(ride, author, target));
    assert.equal(Boolean(row), present);
    if (row) {
      assert.equal(row.rideSessionId, ride); assert.equal(row.authorUserId, author);
      assert.equal(row.ratedUserId, target); assert.equal(row.score, 5);
    }
  }
  const driver = state.driverInbox.reviews, parent = state.parentInbox.reviews;
  assert.equal(driver.length, phase === 'new-prompt' ? 1 : 0);
  if (driver.length) {assert.equal(driver[0].rideSessionId, fixture.freshRide); assert.equal(driver[0].ratedUserId, fixture.parentUid);}
  assert.equal(parent.length, (index === 0 ? 26 : 27) - Number(parentRated));
  assert(parent.every(row => row.ratedUserId === fixture.driverUid));
  assert.equal(new Set(parent.map(row => row.id)).size, parent.length);
  assert.equal(parent.some(row => row.rideSessionId === fixture.rides[0]), !parentRated);
  return {phase, status: 'passed', ratingCount: expected, driverPrompts: driver.length, parentPrompts: parent.length,
    phoneUiProvenByThisObserver: false, processRestartProven: false, productionWrites: false};
}
