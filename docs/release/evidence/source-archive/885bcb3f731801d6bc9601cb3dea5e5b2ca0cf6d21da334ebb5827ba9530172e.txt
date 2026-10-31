import assert from 'node:assert/strict';

export const teamAuthorityPhases = ['initial', 'revoked', 'renewed', 'new-message', 'replied'];
export const teamAuthorityIncoming = 'Après nouvel accord QA';
export const teamAuthorityReply = 'Réponse après nouvel accord QA';

export function verifyTeamAuthorityCheckpoint(phase, state, fixture) {
  assert(teamAuthorityPhases.includes(phase));
  const index = teamAuthorityPhases.indexOf(phase), renewed = index >= 2;
  assert.equal(state.guardian.status, phase === 'revoked' ? 'revoked' : 'verified');
  assert.equal(state.guardian.revision, index === 0 ? 2 : index === 1 ? 3 : 5);
  assert.equal(state.parentDenied, phase === 'revoked');
  const expected = index === 0 ? [fixture.initialMessageId] : index <= 2 ? [] :
    [fixture.newMessageId, ...(phase === 'replied' ? [state.parentMessageId] : [])];
  assert.deepEqual(state.parentMessageIds.slice().sort(), expected.slice().sort());
  assert(!state.parentMessageIds.includes(fixture.earlyMessageId));
  if (renewed) assert(!state.parentMessageIds.includes(fixture.initialMessageId));
  const total = index <= 2 ? 2 : phase === 'new-message' ? 3 : 4;
  assert.equal(state.entries.length, total); assert.equal(state.lastSequence, total);
  assert.deepEqual(state.entries.map(row => row.sequence), Array.from({length: total}, (_, i) => i + 1));
  assert.equal(new Set(state.entries.map(row => row.clientMessageId)).size, total);
  assert.deepEqual(state.operationIds.slice().sort(), state.entries.map(row => row.id).sort());
  assert.deepEqual(state.otherParentMessageIds.slice().sort(), state.entries.slice(1).map(row => row.id).sort());
  const replies = state.entries.filter(row => row.senderUserId === fixture.parentUid);
  assert.equal(replies.length, phase === 'replied' ? 1 : 0);
  if (phase === 'replied') {
    assert.equal(replies[0].body, teamAuthorityReply); assert.equal(replies[0].id, state.parentMessageId);
  }
  if (index >= 3) {
    const incoming = state.entries.find(row => row.id === fixture.newMessageId);
    assert(incoming); assert.equal(incoming.senderUserId, fixture.driverUid);
    assert.equal(incoming.body, teamAuthorityIncoming);
  }
  return { phase, parentDenied: state.parentDenied, guardianRevision: state.guardian.revision,
    visibleParentMessages: expected.length, storedMessages: total, historicalMessagesRestored: false };
}
