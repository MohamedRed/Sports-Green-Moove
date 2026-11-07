import assert from 'node:assert/strict';

export const historyPhonePhases = ['history-list', 'history-page-2', 'history-withdrawn', 'history-child-read-only', 'history-refreshed'];

export function verifyHistoryPhoneCheckpoint(phase, state, identity) {
  const index = historyPhonePhases.indexOf(phase); assert(index >= 0, 'Unknown history checkpoint');
  const withdrawn = index >= 2, revision = withdrawn ? 3 : 2;
  assert.equal(state.membership.active, false); assert.equal(state.membership.status, 'inactive');
  assert.equal(state.guardian.status, 'revoked'); assert.equal(state.guardian.revision, 3);
  assert.equal(state.enrollments.length, 26); assert.equal(state.events.length, withdrawn ? 29 : 28);
  assert.equal(state.first.items.length, 20); assert(state.first.nextCursor);
  assert.equal(state.second.items.length, 6); assert.equal(state.second.nextCursor, null);
  const ids = [...state.first.items, ...state.second.items].map((row) => row.id);
  assert.equal(new Set(ids).size, 26); assert.deepEqual(ids.sort(), state.enrollments.map((row) => row.id).sort());
  for (const [view, id, kind, subjectId, status, rev, actions] of [
    [state.self, identity.selfEnrollmentId, 'member', identity.parentId, withdrawn ? 'withdrawn' : 'approved', revision, withdrawn ? [] : ['withdraw']],
    [state.child, identity.childEnrollmentId, 'child', identity.childId, 'approved', 2, []],
  ]) {
    assert.equal(view.id, id); assert.equal(view.requesterUserId, identity.parentId);
    assert.equal(view.teamInstanceId, identity.teamInstanceId); assert.equal(view.subjectName, null);
    assert.equal(view.eligible, false); assert.deepEqual(view.allowedActions, actions);
    assert.equal(view.status, status); assert.equal(view.revision, rev);
    const stored = state.enrollments.find((row) => row.id === id); assert(stored);
    assert.equal(stored.status, status); assert.equal(stored.revision, rev);
    assert.equal(stored.subjectKind, kind); assert.equal(stored.subjectId, subjectId);
    const events = state.events.filter((row) => row.enrollmentId === id).sort((a, b) => a.revision - b.revision);
    assert.equal(events.length, rev);
    events.forEach((event, eventIndex) => {
      assert.equal(event.action, ['request', 'approve', 'withdraw'][eventIndex]); assert.equal(event.revision, eventIndex + 1);
      assert.equal(event.actorUserId, eventIndex === 1 ? identity.managerId : identity.parentId);
    });
  }
  return { phase, ownedCount: 26, pageCounts: [20, 6], selfRevision: revision,
    selfStatus: state.self.status, childStatus: 'approved', childNameRedacted: true, childActions: [] };
}
