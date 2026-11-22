import assert from 'node:assert/strict';

export const teamPhonePhases = [
  ['self-requested', 'requested', 1, null, 0], ['self-refused', 'refused', 2, null, 0],
  ['self-requested-again', 'requested', 3, null, 0], ['self-approved', 'approved', 4, null, 0],
  ['self-withdrawn', 'withdrawn', 5, null, 0], ['child-requested', 'withdrawn', 5, 'requested', 1],
  ['child-approved', 'withdrawn', 5, 'approved', 2],
];
const actions = ['request', 'refuse', 'request', 'approve', 'withdraw'];

export function verifyManualTeamCheckpoint(phase, state, identity) {
  const expected = teamPhonePhases.find((row) => row[0] === phase);
  assert(expected, 'Unknown manual team checkpoint');
  const [, selfStatus, selfRevision, childStatus, childRevision] = expected;
  assert.equal(state.enrollments.length, childRevision ? 2 : 1);
  assert.equal(state.events.length, selfRevision + childRevision);
  for (const [id, kind, subjectId, status, revision, sequence] of [
    [identity.selfEnrollmentId, 'member', identity.parentId, selfStatus, selfRevision, actions],
    [identity.childEnrollmentId, 'child', identity.childId, childStatus, childRevision, ['request', 'approve']],
  ]) {
    const record = state.enrollments.find((row) => row.id === id);
    const events = state.events.filter((row) => row.enrollmentId === id).sort((a, b) => a.revision - b.revision);
    if (!revision) { assert.equal(record, undefined); assert.equal(events.length, 0); continue; }
    assert(record); assert.equal(record.status, status); assert.equal(record.revision, revision);
    assert.equal(record.clubId, identity.clubId); assert.equal(record.teamId, identity.teamId);
    assert.equal(record.teamInstanceId, identity.teamInstanceId); assert.equal(record.requesterUserId, identity.parentId);
    assert.equal(record.subjectKind, kind); assert.equal(record.subjectId, subjectId);
    assert.equal(events.length, revision);
    for (const [index, event] of events.entries()) {
      assert.equal(event.action, sequence[index]); assert.equal(event.revision, index + 1);
      assert.equal(event.actorUserId, ['request', 'withdraw'].includes(event.action) ? identity.parentId : identity.managerId);
      assert.equal(event.teamId, identity.teamId); assert.equal(event.clubId, identity.clubId);
    }
  }
  assert.equal(state.guardian.status, 'verified'); assert.equal(state.guardian.revision, 2);
  return { phase, selfStatus, selfRevision, childStatus, childRevision,
    enrollmentCount: state.enrollments.length, eventCount: state.events.length };
}
