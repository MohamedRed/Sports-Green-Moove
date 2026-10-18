import assert from 'node:assert/strict';

const common = ['projectId', 'runId', 'scope', 'stage', 'completed', 'actorUserId', 'processId', 'tripId', 'otherTripId', 'draftHash'];
const keys = (record, expected) => assert.deepEqual(Object.keys(record).sort(), [...expected].sort(), 'Only sanitized typed draft evidence may be archived');

export function assertPreparedTripDraft(before, runId) {
  keys(before, [...common, 'unfinishedFieldsSaved', 'otherTripIsolated']); assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(before.projectId, 'demo-sgm-local-qa'); assert.equal(before.runId, runId);
  assert.equal(before.scope, 'native-ui-private-trip-draft-restart'); assert.equal(before.stage, 'before');
  assert.equal(before.completed, true); assert.equal(before.actorUserId, 'sgm-qa-driver');
  assert(Number.isSafeInteger(before.processId) && before.processId > 0);
  for (const key of ['tripId', 'otherTripId']) assert(typeof before[key] === 'string' && before[key].length > 0);
  assert.notEqual(before.tripId, before.otherTripId); assert.match(before.draftHash, /^[a-f0-9]{64}$/);
  assert.equal(before.unfinishedFieldsSaved, true); assert.equal(before.otherTripIsolated, true);
}

export function assertTripDraftRestart(before, stopped, after, fixture, runId) {
  assertPreparedTripDraft(before, runId);
  keys(after, [...common, 'sessionRestoredWithoutLogin', 'unfinishedFieldsRestored', 'otherTripIsolated', 'submissionDisabled']);
  keys(stopped, ['projectId', 'runId', 'scope', 'appId', 'preparedProcessId', 'observedBeforePid', 'forceStopIssued', 'noProcessAfterStop']);
  assert.equal(before.tripId, fixture.tripId); assert.equal(before.otherTripId, fixture.otherTripId);
  assert.equal(after.projectId, before.projectId); assert.equal(after.runId, runId);
  assert.equal(after.scope, before.scope); assert.equal(after.stage, 'after'); assert.equal(after.completed, true);
  for (const key of ['actorUserId', 'tripId', 'otherTripId', 'draftHash']) assert.equal(after[key], before[key]);
  assert(Number.isSafeInteger(after.processId) && after.processId > 0); assert.notEqual(after.processId, before.processId);
  for (const key of ['sessionRestoredWithoutLogin', 'unfinishedFieldsRestored', 'otherTripIsolated', 'submissionDisabled']) assert.equal(after[key], true);
  assert.equal(stopped.projectId, before.projectId); assert.equal(stopped.runId, runId);
  assert.equal(stopped.scope, 'disposable-local-app-force-stop'); assert.equal(stopped.appId, 'be.sportgreenmoove.app.local');
  assert.equal(stopped.preparedProcessId, before.processId);
  assert(stopped.observedBeforePid === null || stopped.observedBeforePid === before.processId);
  assert.equal(stopped.forceStopIssued, true); assert.equal(stopped.noProcessAfterStop, true);
}
