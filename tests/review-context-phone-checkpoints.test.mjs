import assert from 'node:assert/strict';
import test from 'node:test';
import {contextPhonePhases, verifyContextPhoneState} from '../scripts/qa/review-context-phone-checkpoints.mjs';

const fixture = {driverUid: 'driver', parentUid: 'parent', missingRide: 'legacy',
  rides: Array.from({length: 31}, (_, index) => 'ride-' + index), contexts: {}, tripIds: {}};
for (const ride of fixture.rides) {fixture.contexts[ride] = {title: 'Entraînement U12', departureAt: '2026-10-29T17:45:00Z',
  departureLabel: '29 octobre 2026 à 18:45'}; fixture.tripIds[ride] = 'trip-' + ride;}
function stateFor(phase) {
  const index = contextPhonePhases.indexOf(phase), driverRated = index > 0, parentRated = index >= 5;
  const review = (ride, author, target) => ({id: `${ride}_${author}_${target}`, rideSessionId: ride, ratedUserId: target,
    tripContext: ride === fixture.missingRide ? null : {tripId: fixture.tripIds[ride], ...fixture.contexts[ride]}});
  const ratings = Array.from({length: 31}, (_, index) => ({id: 'original-' + index}));
  for (const [present, author, target] of [[driverRated, 'driver', 'parent'], [parentRated, 'parent', 'driver']]) if (present)
    ratings.push({id: `ride-30_${author}_${target}`, rideSessionId: 'ride-30', authorUserId: author, ratedUserId: target, score: 5});
  return {ratings, driver: driverRated ? [] : [review('ride-30', 'driver', 'parent')],
    parent: [...fixture.rides.filter(ride => !parentRated || ride !== 'ride-30'), fixture.missingRide].map(ride => review(ride, 'parent', 'driver'))};
}
for (const phase of contextPhonePhases) test('independent context checkpoint: ' + phase, () => {
  const result = verifyContextPhoneState(phase, stateFor(phase), fixture);
  assert.equal(result.status, 'passed'); assert.equal(result.phoneUiProvenByThisObserver, false); assert.equal(result.processRestartProven, false);
});
for (const [name, phase, mutate] of [
  ['a fabricated date', 'driver-context', state => {state.driver[0].tripContext.departureLabel = 'today';}],
  ['wrong same-named ride removed', 'parent-rated', state => {state.parent[0].rideSessionId = 'ride-30';}],
  ['legacy request dropped', 'parent-more', state => {state.parent.pop();}],
  ['legacy date invented', 'parent-more', state => {state.parent.at(-1).tripContext = fixture.contexts['ride-0'];}],
  ['foreign parent target', 'parent-more', state => {state.parent[0].ratedUserId = 'outsider';}],
  ['a duplicate prompt', 'parent-more', state => {state.parent[2] = state.parent[1];}],
  ['an unexpected write before the phone sends', 'driver-context', state => {state.ratings.push({id: 'unexpected'});}],
  ['wrong rating score', 'parent-rated', state => {state.ratings.at(-1).score = 1;}],
]) test('rejects ' + name, () => {const state = stateFor(phase); mutate(state); assert.throws(() => verifyContextPhoneState(phase, state, fixture));});
