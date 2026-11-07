import assert from 'node:assert/strict';

export const teamDraftScope = 'local-team-draft-process-restart-not-physical-or-push';
export function validateTeamDraftBefore(before, runId) {
  assert.equal(before.scope, teamDraftScope + '-checkpoint'); assert.equal(before.projectId, 'demo-sgm-local-qa');
  assert.equal(before.runId, runId); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['draft-prepared', 'draft-sent'].includes(before.phase));
  assert(Number.isSafeInteger(before.processId) && before.processId > 0);
  assert.match(before.teamInstanceId, /^[a-f0-9]{64}$/);
  if (before.phase === 'draft-sent') {
    assert(Number.isSafeInteger(before.firstProcessId) && before.firstProcessId > 0 && before.firstProcessId !== before.processId);
    assert.match(before.messageId, /^[A-Za-z0-9_-]{1,200}$/);
  }
}
export function validateTeamDraftRestart(before, firstStop, sent, secondStop, marker, runId) {
  for (const value of [before, sent]) validateTeamDraftBefore(value, runId);
  assert.equal(before.phase, 'draft-prepared'); assert.equal(sent.phase, 'draft-sent');
  assert.equal(sent.firstProcessId, before.processId); assert.equal(sent.teamInstanceId, before.teamInstanceId);
  for (const [prepared, stopped] of [[before, firstStop], [sent, secondStop]]) {
    assert.equal(stopped.scope, 'disposable-local-app-force-stop'); assert.equal(stopped.projectId, before.projectId);
    assert.equal(stopped.runId, runId); assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
    assert.equal(stopped.preparedProcessId, prepared.processId);
    assert(stopped.observedBeforePid === null || stopped.observedBeforePid === prepared.processId);
    assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  }
  assert.equal(marker.scope, teamDraftScope); assert.equal(marker.projectId, before.projectId); assert.equal(marker.runId, runId);
  assert.equal(marker.firstProcessId, before.processId); assert.equal(marker.secondProcessId, sent.processId);
  assert(Number.isSafeInteger(marker.processId) && marker.processId > 0);
  assert.equal(new Set([marker.firstProcessId, marker.secondProcessId, marker.processId]).size, 3);
  assert.equal(marker.messageId, sent.messageId);
  for (const key of ['draftRestored', 'explicitSendIndependentlyRead', 'acknowledgedDraftCleared',
    'otherAccountDraftEmpty', 'parentSignedOut', 'completed']) assert.equal(marker[key], true, key);
}
