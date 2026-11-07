import assert from 'node:assert/strict';

export const childAccountPhonePhases = ['child-signed-in', 'code-created', 'parent-review', 'parent-approved', 'child-return', 'signed-out'];
export const childAccountPhoneCollections = ['childAccountLinks', 'childAccountApprovalOwners', 'childAccountApprovalRequests'];
const approvedPhases = new Set(childAccountPhonePhases.slice(3));
const stamp = value => {
  assert.deepEqual(Object.keys(value).sort(), ['nanoseconds', 'seconds']);
  assert(Number.isSafeInteger(value.seconds) && value.seconds > 0);
  assert(Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1e9);
  return value.seconds * 1000 + value.nanoseconds / 1e6;
};

export function verifyChildAccountPhoneCheckpoint(phase, baseline, current, fixture, previous) {
  assert(childAccountPhonePhases.includes(phase));
  assert.notEqual(fixture.childUid, fixture.parentUid); assert.notEqual(fixture.childUid, fixture.childId);
  assert.match(fixture.childInstanceId, /^[a-f0-9]{64}$/);
  const privateRows = state => Object.fromEntries(childAccountPhoneCollections.map(name => {
    assert(Array.isArray(state.documents[name])); return [name, state.documents[name]];
  }));
  const initial = privateRows(baseline), rows = privateRows(current);
  assert(Object.values(initial).every(list => list.length === 0), 'Approval cannot be seeded');
  const protectedRows = state => Object.fromEntries(Object.entries(state.documents).filter(([name]) => !childAccountPhoneCollections.includes(name)));
  assert.deepEqual(current.claims, baseline.claims, 'Phone linking cannot grant or change account roles');
  assert(Object.hasOwn(baseline, 'liveData') && Object.hasOwn(current, 'liveData'));
  assert.deepEqual(current.liveData, baseline.liveData, 'Pairing cannot change live tracking data');
  assert.deepEqual(protectedRows(current), protectedRows(baseline), 'Unrelated records changed');
  if (phase === 'child-signed-in') assert.deepEqual(rows, initial);
  else {
    assert.equal(rows.childAccountApprovalOwners.length, 1); assert.equal(rows.childAccountApprovalRequests.length, 1);
    const owner = rows.childAccountApprovalOwners[0], request = rows.childAccountApprovalRequests[0];
    assert.equal(owner.id, fixture.childUid); assert.equal(owner.data.accountUserId, fixture.childUid);
    assert.match(owner.data.codeHash, /^[a-f0-9]{64}$/); assert.equal(owner.data.codeHash, request.id);
    assert.deepEqual(Object.keys(owner.data).sort(), ['accountUserId', 'codeHash', 'createdAt']);
    assert.equal(request.data.accountUserId, fixture.childUid);
    assert.deepEqual(owner.data.createdAt, request.data.createdAt);
    assert.equal(Math.round(stamp(request.data.expiresAt) - stamp(request.data.createdAt)), 600_000);
    if (!approvedPhases.has(phase)) {
      assert.equal(rows.childAccountLinks.length, 0); assert.equal(request.data.status, 'pending');
      assert.deepEqual(Object.keys(request.data).sort(), ['accountUserId', 'createdAt', 'expiresAt', 'status']);
    } else {
      assert.equal(rows.childAccountLinks.length, 1); const link = rows.childAccountLinks[0];
      assert.equal(link.id, fixture.childUid); assert.equal(link.data.accountUserId, fixture.childUid);
      assert.equal(link.data.childId, fixture.childId); assert.equal(link.data.childInstanceId, fixture.childInstanceId);
      assert.equal(link.data.status, 'verified'); assert.equal(link.data.verifiedByUserId, fixture.parentUid);
      assert(stamp(link.data.verifiedAt) >= stamp(request.data.createdAt));
      assert.equal(request.data.status, 'approved'); assert.equal(request.data.approvedByUserId, fixture.parentUid);
      assert.equal(request.data.childId, fixture.childId); assert.equal(request.data.childInstanceId, fixture.childInstanceId);
      assert.deepEqual(link.data.verifiedAt, request.data.approvedAt);
      assert.deepEqual(Object.keys(link.data).sort(), ['accountUserId', 'childId', 'childInstanceId', 'status', 'verifiedAt', 'verifiedByUserId']);
      assert.deepEqual(Object.keys(request.data).sort(), ['accountUserId', 'approvedAt', 'approvedByUserId', 'childId', 'childInstanceId', 'createdAt', 'expiresAt', 'status']);
    }
  }
  if (phase === 'parent-review' || phase === 'child-return' || phase === 'signed-out') {
    assert(previous); assert.deepEqual(current, previous, 'A review, account return or sign-out cannot alter the approval');
  }
  if (phase === 'parent-approved') {
    assert(previous); const before = privateRows(previous);
    assert.deepEqual(rows.childAccountApprovalOwners, before.childAccountApprovalOwners);
    const old = before.childAccountApprovalRequests[0]; assert(old && old.data.status === 'pending');
    const next = rows.childAccountApprovalRequests[0]; assert.equal(next.id, old.id);
    for (const key of ['accountUserId', 'createdAt', 'expiresAt']) assert.deepEqual(next.data[key], old.data[key]);
  }
  return { phase, status: 'passed', approved: approvedPhases.has(phase), accountClaimsUnchanged: true,
    protectedRecordsUnchanged: true, physicalUiProvenByThisCheckpoint: false, signupProven: false, trackingProven: false };
}
