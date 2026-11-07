import assert from 'node:assert/strict';
import test from 'node:test';
import {reviewPhonePhases, verifyReviewPhoneCheckpoint} from '../scripts/qa/review-history-phone-checkpoints.mjs';

const fixture = {driverUid: 'driver', parentUid: 'parent', peers: ['parent', 'peer-2', 'peer-3', 'peer-4'],
  rides: Array.from({length: 26}, (_, i) => 'ride-' + i), freshRide: 'new-ride'};
const rating = (ride, author, peer, score) => ({id: `${ride}_${author}_${peer}`, rideSessionId: ride, authorUserId: author, ratedUserId: peer, score});
const prompt = (ride, author, peer) => ({id: `${ride}_${author}_${peer}`, rideSessionId: ride, ratedUserId: peer});
function state(phase) {
  const index = reviewPhonePhases.indexOf(phase);
  const ratings = fixture.rides.flatMap(ride => fixture.peers.map(peer => rating(ride, 'driver', peer, 4)));
  if (index >= 2) ratings.push(rating(fixture.freshRide, 'driver', 'parent', 5));
  if (index >= 5) ratings.push(rating(fixture.rides[0], 'parent', 'driver', 5));
  const parentRides = [...fixture.rides, ...(index > 0 ? [fixture.freshRide] : [])].filter(ride => index < 5 || ride !== fixture.rides[0]);
  return {ratings, driverInbox: {reviews: phase === 'new-prompt' ? [prompt(fixture.freshRide, 'driver', 'parent')] : []},
    parentInbox: {reviews: parentRides.map(ride => prompt(ride, 'parent', 'driver'))}};
}
test('seven independent stages distinguish fixture writes, new phone ratings and each account', () => {
  for (const phase of reviewPhonePhases) {
    const result = verifyReviewPhoneCheckpoint(phase, state(phase), fixture);
    assert.equal(result.status, 'passed'); assert.equal(result.phoneUiProvenByThisObserver, false);
    assert.equal(result.processRestartProven, false); assert.equal(result.productionWrites, false);
  }
});
for (const [name, phase, mutate] of [
  ['returned rating prompt', 'driver-returned', row => row.driverInbox.reviews.push(prompt('ride-0', 'driver', 'parent'))],
  ['overwritten original score', 'signed-out', row => {row.ratings[0].score = 5;}],
  ['wrong original ride', 'signed-out', row => {row.ratings[0].rideSessionId = 'other';}],
  ['wrong original target', 'signed-out', row => {row.ratings[0].ratedUserId = 'other';}],
  ['wrong new author', 'driver-rated', row => {row.ratings.at(-1).authorUserId = 'parent';}],
  ['missing first parent prompt', 'parent-prompt', row => row.parentInbox.reviews.shift()],
  ['duplicate parent prompt', 'parent-prompt', row => {row.parentInbox.reviews[0] = row.parentInbox.reviews[1];}],
  ['wrong new prompt target', 'new-prompt', row => {row.driverInbox.reviews[0].ratedUserId = 'other';}],
  ['missing original rating', 'signed-out', row => row.ratings.shift()],
]) test('rejects ' + name, () => {const row = state(phase); mutate(row); assert.throws(() => verifyReviewPhoneCheckpoint(phase, row, fixture));});
