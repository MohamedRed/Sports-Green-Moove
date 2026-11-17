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

export function assertCompletedRideRecordChanges(before, after, fixture) {
  const previousIds = new Set(before.co2Ledger.map((row) => row.id));
  const created = after.co2Ledger.filter((row) => !previousIds.has(row.id));
  assert.equal(created.length, 1, 'A completed zero-distance trial must create exactly one impact record');
  const impact = created[0];
  assert.equal(impact.id, `rideCompletion_${encodeURIComponent(fixture.rideSessionId)}`);
  assert.equal(impact.type, 'rideCompletion');
  assert.equal(impact.sourceId, fixture.rideSessionId); assert.equal(impact.rideSessionId, fixture.rideSessionId);
  assert.equal(impact.userId, 'sgm-qa-driver'); assert.equal(impact.driverUserId, 'sgm-qa-driver');
  assert.equal(impact.distanceMeters, 0); assert.equal(impact.co2SavedKg, 0);
  const report = assertIsolatedRideRecordChanges(before, { ...after,
    co2Ledger: after.co2Ledger.filter((row) => row !== impact) }, fixture);
  return { ...report, createdRecordCounts: { ...report.createdRecordCounts, co2Ledger: 1 }, zeroDistanceImpactVerified: true };
}
