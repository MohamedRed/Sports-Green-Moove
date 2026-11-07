import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ridePhonePhases, verifyRidePhoneCheckpoint } from '../scripts/qa/manual-ride-phone-checkpoints.mjs';

const fixture = { tripId: 'trip', bookingId: 'booking', childId: 'child', parentUid: 'parent', driverUid: 'driver' };
function state(phase) {
  const ended = ['completed', 'reviewed'].includes(phase);
  const picked = !['prepared', 'started'].includes(phase), dropped = !['prepared', 'started', 'picked-up'].includes(phase);
  return { trip: { id: 'trip', driverUserId: 'driver', priceCents: 0, status: ended ? 'completed' : 'published' },
    booking: { id: 'booking', tripId: 'trip', childId: 'child', parentUserId: 'parent', driverUserId: 'driver', seats: 2,
      status: ended ? 'completed' : 'approved', ...(picked ? { pickupStatus: 'pickedUp' } : {}), ...(dropped ? { dropoffStatus: 'droppedOff' } : {}) },
    rides: phase === 'prepared' ? [] : [{ id: 'ride', tripId: 'trip', driverUserId: 'driver', bookingIds: ['booking'],
      status: ended ? 'completed' : 'active', passengers: [{ bookingId: 'booking', childId: 'child',
        pickupStatus: picked ? 'pickedUp' : 'pending', dropoffStatus: dropped ? 'droppedOff' : 'pending' }] }],
    audit: [...(picked ? ['pickup'] : []), ...(dropped ? ['dropoff'] : [])].map(action => ({ action, bookingId: 'booking', childId: 'child' })),
    co2: ended ? [{ rideSessionId: 'ride', userId: 'driver', co2SavedKg: 0 }] : [], rewards: [],
    ratings: phase === 'reviewed' ? [{ rideSessionId: 'ride', authorUserId: 'parent', ratedUserId: 'driver', score: 5 }] : [] };
}
for (const phase of ridePhonePhases) test('one exact independent ride checkpoint: ' + phase, () => {
  const result = verifyRidePhoneCheckpoint(phase, state(phase), fixture);
  assert.equal(result.phoneUiVerifiedByController, false); assert.equal(result.physicalTrackingAccepted, false);
});
for (const [name, mutate] of [
  ['wrong seats', row => { row.booking.seats = 1; }],
  ['missing dropoff', row => { row.rides[0].passengers[0].dropoffStatus = 'pending'; }],
  ['duplicate audit', row => { row.audit.push(row.audit[0]); }],
  ['duplicate ride', row => { row.rides.push(row.rides[0]); }],
  ['invented distance reward', row => { row.rewards.push({ rideSessionId: 'ride', userId: 'driver' }); }],
  ['wrong rating author', row => { row.ratings[0].authorUserId = 'other'; }],
]) test('ride checkpoint refuses ' + name, () => {
  const row = state('reviewed'); mutate(row); assert.throws(() => verifyRidePhoneCheckpoint('reviewed', row, fixture));
});
test('the interactive controller observes after fixture preparation, without performing ride actions', () => {
  const source = readFileSync('scripts/qa/manual-ride-phone-session.mjs', 'utf8');
  const start = source.indexOf('for await (const command of input)');
  const observations = source.slice(start, source.indexOf('} catch (error)', start));
  assert.doesNotMatch(observations, /call\(|\.set\(|\.update\(|\.create\(|\.delete\(/);
  assert.match(observations, /performance.now\(\) - droppedAt >= 1_500/);
  assert.match(source, /not-phone-ui-proof/);
});
