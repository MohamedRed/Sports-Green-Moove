import assert from 'node:assert/strict';

export function assertPreparedChatRestart(before, runId) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-ui-confirmed-conversation-restart-stage');
  assert.equal(before.stage, 'before'); assert.equal(before.completed, true);
  assert.equal(before.actorUserId, 'sgm-qa-parent');
  assert(Number.isInteger(before.processId) && before.processId > 0);
  assert.equal(before.firstMessageConfirmed, true);
}

export function assertChatRestartReceipt(before, stopped, after, runId) {
  assertPreparedChatRestart(before, runId);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop');
  assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  assert.equal(after.projectId, before.projectId); assert.equal(after.runId, runId);
  assert.equal(after.scope, before.scope); assert.equal(after.stage, 'after');
  assert.equal(after.completed, true); assert.equal(after.actorUserId, before.actorUserId);
  assert(Number.isInteger(after.processId) && after.processId > 0);
  assert.notEqual(after.processId, before.processId);
  for (const key of ['sessionRestoredWithoutLogin', 'confirmedHistoryRestored', 'newSendConfirmed',
    'driverReplyReceived', 'bothInboxesRead']) assert.equal(after[key], true, `Missing restart proof: ${key}`);
}

export function assertChatRestartInteractionReceipt(before, stopped, after, runId) {
  assertChatRestartReceipt(before, stopped, after, runId);
  assert.equal(before.sendActor, 'first'); assert.equal(before.sendPhase, 'confirmed');
  assert.equal(after.sendActor, 'driver-reply'); assert.equal(after.sendPhase, 'confirmed');
}
