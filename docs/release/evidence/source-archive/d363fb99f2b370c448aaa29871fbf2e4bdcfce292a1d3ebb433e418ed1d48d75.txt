import assert from 'node:assert/strict';

export const profileLedgerPhonePhases = ['parent-ready', 'parent-city-saved', 'parent-rewards',
  'driver-ready', 'driver-rewards', 'driver-payments', 'parent-returned', 'parent-city-cleared', 'parent-returned-balance'];

export function verifyProfileLedgerPhoneState(phase, baseline, state, fixture, previous) {
  assert(profileLedgerPhonePhases.includes(phase));
  const expectedRevision = phase === 'parent-ready' ? 0 : ['parent-city-cleared', 'parent-returned-balance'].includes(phase) ? 2 : 1;
  assert.deepEqual(state.cities.parent, {userId: fixture.parentUid, city: expectedRevision === 1 ? 'Liège' : null, revision: expectedRevision});
  assert.deepEqual(state.cities.driver, {userId: fixture.driverUid, city: 'Namur', revision: 1});
  for (const [key, expected] of [['parent', fixture.parentLedger], ['driver', fixture.driverLedger]]) {
    assert.deepEqual(state.ledgers[key], expected, 'Profile actions and account changes cannot alter accounting');
  }
  const stable = value => ({...value.records, documents: {...value.records.documents,
    profileCities: (value.records.documents.profileCities ?? []).filter(row => row.id !== fixture.parentUid)}});
  assert.deepEqual(stable(state), stable(baseline), 'Every other record and account claim must remain unchanged');
  const parent = (state.records.documents.profileCities ?? []).find(row => row.id === fixture.parentUid);
  if (expectedRevision === 0) assert.equal(parent, undefined);
  else { assert.equal(parent.data.city, state.cities.parent.city); assert.equal(parent.data.revision, expectedRevision); }
  if (!['parent-city-saved', 'parent-city-cleared'].includes(phase)) assert.deepEqual(state, previous ?? baseline,
    'Read-only phone navigation cannot rewrite the accepted city event');
  return {phase, parentRevision: expectedRevision, driverRevision: 1,
    protectedRecordsUnchanged: true, claimsUnchanged: true, ledgersUnchanged: true};
}
