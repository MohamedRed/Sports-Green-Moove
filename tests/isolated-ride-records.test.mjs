import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolatedRideRecordChanges } from '../scripts/qa/isolated-ride-records.mjs';

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
