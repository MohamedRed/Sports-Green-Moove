import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotSessionRestorationRecords, verifySessionRestorationRecords } from '../scripts/qa/session-restoration-records.mjs';

function fixture() {
  const state = { records: {
    users: [{ id: 'sgm-qa-parent', data: { updatedAt: 1, roles: { parent: true }, displayName: 'Parent QA' } },
      { id: 'sgm-qa-driver', data: { updatedAt: 2, roles: { driver: true } } }],
    bookings: [{ id: 'booking', data: { status: 'approved' } }],
  }, claims: [{ uid: 'sgm-qa-driver', customClaims: { roleKeys: ['driver'] } },
    { uid: 'sgm-qa-parent', customClaims: { roleKeys: ['parent'] } }], live: { ride: { meta: { status: 'active' } } } };
  const db = {
    listCollections: async () => Object.keys(state.records).map(id => ({ id })),
    collection: name => ({ orderBy: () => ({ get: async () => ({ docs: state.records[name]
      .map(row => ({ id: row.id, data: () => structuredClone(row.data) })) }) }) }),
  };
  const auth = { listUsers: async size => { assert.equal(size, 1000); return { users: state.claims }; } };
  const database = { ref: path => { assert.equal(path, 'liveTrips'); return { get: async () => ({ val: () => structuredClone(state.live) }) }; } };
  return { state, capture: () => snapshotSessionRestorationRecords(db, auth, database), db, auth, database };
}
test('only the selected parent timestamp is excluded, without mutating the original records', async () => {
  const f = fixture(), original = structuredClone(f.state), before = await f.capture();
  assert.deepEqual(f.state, original);
  f.state.records.users[0].data.updatedAt = 100;
  const result = verifySessionRestorationRecords(before, await f.capture());
  assert.equal(result.allUserClaimsUnchanged, true);
  assert.equal(result.allTopLevelCollectionsUnchangedExceptParentTimestamp, true);
  assert.equal(result.liveTripsUnchanged, true); assert.equal(result.accountCount, 2);
  assert.deepEqual(result.collections, { bookings: 1, users: 2 });
});
for (const [label, mutate] of [
  ['foreign timestamps', f => { f.state.records.users[1].data.updatedAt = 3; }],
  ['parent roles', f => { f.state.records.users[0].data.roles.driver = true; }],
  ['claims', f => { f.state.claims[1].customClaims.roleKeys.push('admin'); }],
  ['bookings', f => { f.state.records.bookings[0].data.status = 'cancelled'; }],
  ['new collections', f => { f.state.records.extra = [{ id: 'x', data: {} }]; }],
  ['live trips', f => { f.state.live.ride.meta.status = 'completed'; }],
]) test(`${label} cannot be hidden by restoration isolation checks`, async () => {
  const f = fixture(), before = await f.capture(); mutate(f);
  const after = await f.capture();
  assert.throws(() => verifySessionRestorationRecords(before, after));
});
test('a truncated account inventory cannot be accepted', async () => {
  const f = fixture(); f.auth.listUsers = async () => ({ users: f.state.claims, pageToken: 'next' });
  await assert.rejects(f.capture());
});
