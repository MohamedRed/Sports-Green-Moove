import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {reviewNetworkPhases, verifyReviewNetworkState} from '../scripts/qa/review-network-phone-checkpoints.mjs';

const fixture = {parentUid: 'parent', driverUid: 'driver', selectedRideId: 'ride-29', rides: [28, 29].map(day =>
  ({id: 'ride-' + day, tripId: 'trip-' + day, departureAt: `2026-10-${day}T17:45:00Z`, departureLabel: `${day} octobre 2026 à 18:45`}))};
function stateFor(phase) {
  const rated = reviewNetworkPhases.indexOf(phase) >= 4;
  const review = (ride, author, target) => ({id: `${ride.id}_${author}_${target}`, rideSessionId: ride.id, ratedUserId: target,
    tripContext: {tripId: ride.tripId, title: 'Entraînement U12', departureAt: ride.departureAt, departureLabel: ride.departureLabel}});
  return {parent: fixture.rides.filter(row => !rated || row.id !== fixture.selectedRideId).map(ride => review(ride, 'parent', 'driver')),
    driver: fixture.rides.map(ride => review(ride, 'driver', 'parent')),
    parentSummary: {userId: 'parent', count: 0, average: null}, driverSummary: {userId: 'driver', count: Number(rated), average: rated ? 5 : null},
    ratings: rated ? [{id: 'ride-29_parent_driver', rideSessionId: 'ride-29', authorUserId: 'parent', ratedUserId: 'driver', score: 5, comment: null}] : []};
}
for (const phase of reviewNetworkPhases) test('observes exact network-review records: ' + phase, () => {
  const row = verifyReviewNetworkState(phase, stateFor(phase), fixture); assert.equal(row.status, 'passed');
  assert.equal(row.physicalNetworkLossProvenByObserver, false); assert.equal(row.phoneUiProvenByObserver, false);
});
for (const [name, phase, mutate] of [
  ['an automatic send before explicit retry', 'online-before-retry', row => row.ratings.push(stateFor('parent-rated').ratings[0])],
  ['the wrong same-name trip removed', 'parent-rated', row => {row.parent[0] = stateFor('parent-ready').parent[1];}],
  ['a fabricated trip date', 'offline-failed', row => {row.parent[0].tripContext.departureLabel = 'Today';}],
  ['a duplicate stored rating', 'parent-rated', row => row.ratings.push(row.ratings[0])],
  ['another target', 'parent-rated', row => {row.ratings[0].ratedUserId = 'other';}],
  ['a changed score', 'parent-rated', row => {row.ratings[0].score = 4;}],
  ['a driver request removed by the parent submission', 'driver-summary', row => row.driver.pop()],
  ['an average/count belonging to another account', 'driver-summary', row => {row.parentSummary = row.driverSummary;}],
]) test('rejects ' + name, () => {const row = stateFor(phase); mutate(row); assert.throws(() => verifyReviewNetworkState(phase, row, fixture));});

test('the observer cannot submit reviews or promote host observations to physical/UI proof', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-review-network-phone.mjs', import.meta.url), 'utf8');
  assert(!/call\(['"]submitRating/.test(source)); assert.match(source, /process.stdin.isTTY/);
  assert.match(source, /originalRecordsAndClaimsPreserved: true/);
  assert.match(source, /controllerSubmittedRatings: false/); assert.match(source, /installedBytesIndependentlyVerified: false/);
  assert.match(source, /phoneUiProvenByObserver: false, physicalNetworkLossProvenByObserver: false/);
});
test('both smoke triggers include the strict observer contract without running a phone fixture in CI', () => {
  const source = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(source.split('"tests/review-network-phone-checkpoints.test.mjs"').length - 1, 2);
  const step = parse(source).jobs.smoke.steps.find(row => row.name === 'Test immutable rating retries after connection loss');
  assert(step.run.includes('tests/review-network-phone-checkpoints.test.mjs'));
  assert(!step.run.includes('manual-review-network-phone.mjs'));
});
