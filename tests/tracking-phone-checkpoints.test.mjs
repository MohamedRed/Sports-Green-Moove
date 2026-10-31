import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {trackingPhonePhases, trackingPhonePoints, verifyTrackingPhoneCheckpoint} from '../scripts/qa/tracking-phone-checkpoints.mjs';

const fixture = {tripId: 'trial', bookingId: 'booking', driverUid: 'driver', parentUid: 'parent'};
function baseline() {
  return {documents: {trips: [{id: 'trial', data: {driverUserId: 'driver', priceCents: 0}},
    {id: 'foreign', data: {driverUserId: 'outsider'}}], bookings: [{id: 'booking', data: {status: 'approved'}}],
  users: [{id: 'driver', data: {name: 'Driver QA'}}, {id: 'parent', data: {name: 'Parent QA'}}]},
  claims: [{uid: 'driver', claims: {roleKeys: ['driver']}}], liveTrips: {foreign: {vehicle: {lat: 1, lng: 1}}}};
}
function state(phase, time = 1000) {
  const value = baseline(); if (phase === 'prepared') return value;
  value.documents.trips[0].data.activeRideSessionId = 'ride';
  value.documents.rideSessions = [{id: 'ride', data: {tripId: 'trial', driverUserId: 'driver', status: 'active',
    bookingIds: ['booking'], participantUserIds: ['parent']}}];
  const point = phase === 'foreground-first' ? trackingPhonePoints.first
    : phase === 'foreground-moved' ? trackingPhonePoints.moved : trackingPhonePoints.background;
  value.liveTrips.ride = {meta: {status: 'active', driverUserId: 'driver', tripId: 'trial'},
    vehicle: {...point, rideSessionId: 'ride', role: 'driver', userId: 'driver', source: 'nativeFallback', capturedAt: time, uploadedAt: time + 1}};
  return value;
}
for (const phase of trackingPhonePhases) test('read-only tracking verifier accepts its scoped phase: ' + phase, () => {
  const previous = phase === 'foreground-moved' ? state('foreground-first', 500)
    : phase === 'background-moved' ? state('foreground-moved', 500) : state(phase);
  const result = verifyTrackingPhoneCheckpoint(phase, state(phase), baseline(), fixture, previous);
  assert.equal(result.phoneUiProven, false); assert.equal(result.realMovementProven, false);
  assert.equal(result.childTrackingProven, false); assert.equal(result.simulatedLocations, true);
});
const mutate = (name, change, phase = 'background-moved') => test('tracking verifier rejects ' + name, () => {
  const value = state(phase); change(value);
  assert.throws(() => verifyTrackingPhoneCheckpoint(phase, value, baseline(), fixture, state('foreground-moved', 500)));
});
mutate('a changed unrelated trip', value => {value.documents.trips[1].data.driverUserId = 'driver';});
mutate('a changed booking', value => {value.documents.bookings[0].data.status = 'cancelled';});
mutate('changed claims', value => {value.claims[0].claims.roleKeys.push('admin');});
mutate('another live-trip update', value => {value.liveTrips.foreign.vehicle.lat = 2;});
mutate('a synthetic child point', value => {value.liveTrips.ride.children = {child: {lat: 1, lng: 1}};});
mutate('a wrong GPS position', value => {value.liveTrips.ride.vehicle.lat = trackingPhonePoints.afterSignOut.lat;});
mutate('a point from another writer', value => {value.liveTrips.ride.vehicle.userId = 'parent';});
mutate('a point for another ride', value => {value.liveTrips.ride.vehicle.rideSessionId = 'other';});
mutate('a provider rather than native point', value => {value.liveTrips.ride.vehicle.source = 'radar';});
mutate('a stale capture', value => {value.liveTrips.ride.vehicle.capturedAt = 500;});
mutate('a missing upload time', value => {delete value.liveTrips.ride.vehicle.uploadedAt;});
mutate('a changed live state after sign-out', value => {value.liveTrips.ride.vehicle.capturedAt = 1500;}, 'signed-out-stable');
test('the observer never starts a ride, writes coordinates or changes accounts after seeding', () => {
  const code = readFileSync(new URL('../scripts/qa/manual-tracking-phone-session.mjs', import.meta.url), 'utf8');
  const after = code.slice(code.indexOf('for await (const command of input)'), code.indexOf('}, {firestore:'));
  assert.doesNotMatch(after, /call\(|\.set\(|\.update\(|signIn\(/);
  assert.match(after, /50_000/); assert.match(after, /verifyTrackingPhoneCheckpoint/);
  assert.match(code, /withLocalAdminCleanup/); assert.match(code, /await db\.terminate\(\)/);
});
