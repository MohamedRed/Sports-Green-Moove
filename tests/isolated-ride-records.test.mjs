import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolatedRideRecordChanges, assertCompletedRideRecordChanges } from '../scripts/qa/isolated-ride-records.mjs';

const fixture = { tripId: 'qa-trip', bookingId: 'qa-booking', rideSessionId: 'qa-ride' };
const before = { trips: [{ id: 'existing-trip', value: 1 }], bookings: [], rideSessions: [], notifications: [], co2Ledger: [], rewardLedger: [] };
const sample = () => ({ ...structuredClone(before), trips: [...before.trips, { id: fixture.tripId }],
  bookings: [{ id: fixture.bookingId }], rideSessions: [{ id: fixture.rideSessionId }],
  notifications: [{ id: 'qa-notification', sourceId: fixture.bookingId }] });
test('the isolated startup may create only its own ride, trip, booking and related notifications', () => {
  assert.equal(assertIsolatedRideRecordChanges(before, sample(), fixture).baselineRecordsPreserved, true);
});
test('missing or modified baseline records fail even when the new ride itself looks correct', () => {
  for (const trips of [[{ id: fixture.tripId }], [{ id: 'existing-trip', value: 2 }, { id: fixture.tripId }]])
    assert.throws(() => assertIsolatedRideRecordChanges(before, { ...sample(), trips }, fixture));
});
test('foreign writes, duplicate identities and unexpected reward or impact changes are rejected', () => {
  for (const patch of [{ trips: [...sample().trips, { id: 'foreign-trip' }] },
    { bookings: [{ id: fixture.bookingId }, { id: fixture.bookingId }] },
    { notifications: [{ id: 'foreign-notification', sourceId: 'another-trip' }] },
    { co2Ledger: [{ id: 'unexpected-impact' }] }, { rewardLedger: [{ id: 'unexpected-reward' }] }])
    assert.throws(() => assertIsolatedRideRecordChanges(before, { ...sample(), ...patch }, fixture));
});
const impact = { id: 'rideCompletion_qa-ride', type: 'rideCompletion', sourceId: fixture.rideSessionId,
  rideSessionId: fixture.rideSessionId, userId: 'sgm-qa-driver', driverUserId: 'sgm-qa-driver', distanceMeters: 0, co2SavedKg: 0 };
test('completion permits exactly its own zero-distance impact without relaxing startup isolation', () => {
  const after = { ...sample(), co2Ledger: [impact] };
  assert.equal(assertCompletedRideRecordChanges(before, after, fixture).zeroDistanceImpactVerified, true);
  assert.throws(() => assertIsolatedRideRecordChanges(before, after, fixture));
});
test('completed fixtures reject foreign, duplicated, rewarded or nonzero-distance records', () => {
  for (const rows of [[], [impact, impact], [{ ...impact, sourceId: 'foreign' }], [{ ...impact, co2SavedKg: 1 }],
    [{ ...impact, distanceMeters: 10 }], [{ ...impact, userId: 'foreign' }]])
    assert.throws(() => assertCompletedRideRecordChanges(before, { ...sample(), co2Ledger: rows }, fixture));
  assert.throws(() => assertCompletedRideRecordChanges(before, { ...sample(), co2Ledger: [impact], rewardLedger: [{ id: 'bonus' }] }, fixture));
});
test('completion preserves all existing impact records byte for byte', () => {
  const previous = { ...before, co2Ledger: [{ id: 'original', value: 1 }] };
  const after = { ...sample(), co2Ledger: [...previous.co2Ledger, impact] };
  assertCompletedRideRecordChanges(previous, after, fixture);
  for (const co2Ledger of [[impact], [{ id: 'original', value: 2 }, impact]])
    assert.throws(() => assertCompletedRideRecordChanges(previous, { ...after, co2Ledger }, fixture));
});
