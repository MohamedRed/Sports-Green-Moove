import assert from 'node:assert/strict';

export function assertPreparedTripConsent(before, runId) {
  assert.deepEqual(Object.keys(before).sort(), ['projectId', 'runId', 'scope', 'stage', 'completed', 'actorUserId',
    'processId', 'tripId', 'bookingId', 'proposalId', 'parentConfirmed', 'notApplied'].sort());
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-ui-confirmed-trip-consent-restart-stage');
  assert.equal(before.stage, 'before'); assert.equal(before.completed, true);
  assert.equal(before.actorUserId, 'sgm-qa-parent');
  assert(Number.isInteger(before.processId) && before.processId > 0);
  for (const key of ['tripId', 'bookingId']) assert.match(before[key], /^[A-Za-z0-9_-]{1,128}$/);
  assert.match(before.proposalId, /^[a-f0-9]{64}$/);
  assert.equal(before.parentConfirmed, true); assert.equal(before.notApplied, true);
}

export function assertTripConsentRestart(before, stopped, after, fixture, runId) {
  assertPreparedTripConsent(before, runId);
  for (const key of ['tripId', 'bookingId']) assert.equal(before[key], fixture[key]);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop');
  assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
  for (const key of ['projectId', 'runId', 'scope', 'actorUserId', 'tripId', 'bookingId', 'proposalId']) assert.equal(after[key], before[key]);
  assert.equal(after.stage, 'after'); assert.equal(after.completed, true);
  assert(Number.isInteger(after.processId) && after.processId > 0); assert.notEqual(after.processId, before.processId);
  for (const key of ['sessionRestoredWithoutLogin', 'originalProposalRestored', 'parentDecisionRestored',
    'duplicateDecisionActionsAbsent', 'explicitRefreshRestored', 'driverSawSameConsent', 'notApplied']) assert.equal(after[key], true, key);
  assert.equal(after.endedAsUserId, 'sgm-qa-driver');
}
