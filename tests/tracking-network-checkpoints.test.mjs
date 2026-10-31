import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {trackingNetworkPhases, verifyTrackingNetworkCheckpoint} from '../scripts/qa/tracking-network-checkpoints.mjs';

const base = new URL('../docs/release/evidence/tracking-clock-replay-2026-10-25/records/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name + '.json', base)));
const {baseline, fixture} = read('baseline');
const first = read('foreground-first').state, moved = read('foreground-moved').state;
for (const phase of trackingNetworkPhases) test('network observation accepts its exact scoped checkpoint: ' + phase, () => {
  const state = phase === 'prepared' ? baseline : ['resumed', 'signed-out', 'signed-out-stable'].includes(phase) ? moved : first;
  const previous = phase === 'signed-out-stable' ? moved : first;
  const result = verifyTrackingNetworkCheckpoint(phase, state, baseline, fixture, previous, 50_000);
  assert.equal(result.simulatedNetwork, true); assert.equal(result.realNetworkLossProven, false);
  assert.equal(result.childTrackingProven, false); assert.equal(result.phoneUiProven, false);
});
test('offline and signed-out stability both require three location intervals', () => {
  for (const [phase, state] of [['offline-stale', first], ['signed-out-stable', moved]]) {
    for (const duration of [0, 49_999, NaN, Infinity])
      assert.throws(() => verifyTrackingNetworkCheckpoint(phase, state, baseline, fixture, state, duration));
  }
});
const mutations = [
  ['another booking', state => {state.documents.bookings[0].data.seats++;}],
  ['claims', state => {state.claims[0].claims.roleKeys.push('admin');}],
  ['child positions', (state, id) => {state.liveTrips[id].children = {child: {lat: 1, lng: 1}};}],
  ['non-monotonic provenance', (state, id) => {state.liveTrips[id].vehicle.captureClock = 'wallClock';}],
  ['point change while offline', (state, id) => {state.liveTrips[id].vehicle.uploadedAt++;}],
  ['another writer', (state, id) => {state.liveTrips[id].vehicle.userId = 'foreign';}],
];
for (const [name, change] of mutations) test('network observation rejects ' + name, () => {
  const state = structuredClone(first), id = read('foreground-first').result.rideId; change(state, id);
  assert.throws(() => verifyTrackingNetworkCheckpoint('offline-stale', state, baseline, fixture, first, 50_000));
});
test('reconnection requires a new capture and upload at the expected coordinate', () => {
  const id = read('foreground-first').result.rideId;
  for (const field of ['capturedAt', 'uploadedAt']) {
    const state = structuredClone(moved); state.liveTrips[id].vehicle[field] = first.liveTrips[id].vehicle[field];
    assert.throws(() => verifyTrackingNetworkCheckpoint('resumed', state, baseline, fixture, first));
  }
});
test('the network observer waits its minimum intervals and cannot upload coordinates after preparation', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-tracking-network-session.mjs', import.meta.url), 'utf8');
  const loop = source.slice(source.indexOf('for await (const command of input)'), source.indexOf('}, {firestore:'));
  assert.doesNotMatch(loop, /call\(|\.set\(|\.update\(|signIn\(/);
  assert.match(loop, /await setTimeout/); assert.match(loop, /50_000/);
});
