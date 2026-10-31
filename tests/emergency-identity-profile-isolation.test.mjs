import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { assertEmergencyIdentityProfiles } from '../scripts/qa/emergency-identity-profile-isolation.mjs';

const old = new Timestamp(100, 1), recent = new Timestamp(100, 2);
const rows = () => [{ id: 'sgm-qa-parent', data: { name: 'Parent fictif QA', roles: { parent: true }, updatedAt: old } },
  { id: 'other-qa', data: { name: 'Autre compte QA', updatedAt: old } }];
test('only the signed-in synthetic parents monotonic server timestamp may change', () => {
  const before = rows(), after = rows(); after[0].data.updatedAt = recent;
  assertEmergencyIdentityProfiles(before, after); assertEmergencyIdentityProfiles(before, before);
  assert.equal(before[0].data.updatedAt, old);
});
test('other profile edits, role changes, timestamp rollback, invalid timestamps and record changes are rejected', () => {
  for (const change of [
    (r) => { r[0].data.name = 'Changed'; }, (r) => { r[0].data.roles.admin = true; },
    (r) => { r[0].data.updatedAt = new Timestamp(100, 0); }, (r) => { r[0].data.updatedAt = { seconds: 100, nanoseconds: 2 }; },
    (r) => { delete r[0].data.updatedAt; }, (r) => { r[1].data.updatedAt = recent; },
    (r) => { r.pop(); }, (r) => { r.push(r[1]); }, (r) => { r.reverse(); },
  ]) { const value = rows(); change(value); assert.throws(() => assertEmergencyIdentityProfiles(rows(), value)); }
});
