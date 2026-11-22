import assert from 'node:assert/strict';

export function assertIsolatedRideRecordChanges(before, after, fixture) {
  const owned = { trips: fixture.tripId, bookings: fixture.bookingId, rideSessions: fixture.rideSessionId };
  const ids = new Set(Object.values(owned)); const counts = {};
  assert.equal(Object.keys(before).sort().join(','), Object.keys(after).sort().join(','));
  for (const name of Object.keys(before)) {
    const previous = new Map(before[name].map((row) => [row.id, row]));
    const current = new Map(after[name].map((row) => [row.id, row]));
    assert.equal(current.size, after[name].length, 'Duplicate fixture identities are not valid');
    for (const [id, original] of previous) assert.deepEqual(current.get(id), original, `Baseline ${name}/${id} changed`);
    const created = after[name].filter((row) => !previous.has(row.id)); counts[name] = created.length;
    if (Object.hasOwn(owned, name)) assert.deepEqual(created.map((row) => row.id), [owned[name]], `Only the selected ${name} fixture may be created`);
    else if (name === 'notifications') assert(created.every((row) => ids.has(row.sourceId)), 'A foreign notification was created');
    else assert.equal(created.length, 0, `Unexpected new ${name} records`);
  }
  return { baselineRecordsPreserved: true, createdRecordCounts: counts };
}
