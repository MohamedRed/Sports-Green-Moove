import assert from 'node:assert/strict';
import { supportResponseGateInput } from './support-submission-response-gate.mjs';

export const supportRecoveryPhases = ['prepared', 'committed', 'offline', 'uncertain', 'reopened', 'confirmed', 'foreign', 'restored'];
export function verifySupportLateConfirmation(state, fixture) {
  const result = verifySupportRecoveryCheckpoint('uncertain', state, fixture);
  assert.equal(fixture.foreignReadDenied, true);
  assert(!state.foreignList.items.some(row => row.id === fixture.reportId));
  return { ...result, phase: 'late-confirmation', explicitRetryVerified: false,
    processRestartVerified: false, scope: 'record-verification-not-phone-ui-proof' };
}
export function verifySupportUnclassifiedReplay(state, fixture) {
  const result = verifySupportRecoveryCheckpoint('confirmed', state, fixture);
  assert.equal(fixture.foreignReadDenied, true);
  assert(!state.foreignList.items.some(row => row.id === fixture.reportId));
  return { ...result, phase: 'unclassified-replay', explicitRetryVerified: false,
    processRestartVerified: false, flowAccepted: false, scope: 'record-integrity-only-replay-origin-unproven' };
}
export function verifySupportRecoveryCheckpoint(phase, state, fixture) {
  assert(supportRecoveryPhases.includes(phase)); assert.equal(fixture.parentUid, supportResponseGateInput.uid);
  assert.equal(state.notifications.length, 0); assert.equal(state.replies.length, 0);
  if (phase === 'prepared') {
    assert.equal(state.reports.length, 0); assert.equal(state.operations.length, 0); assert.equal(state.attempts.length, 0);
    assert.equal(state.held, null); assert.equal(state.released, null); return { phase, reportCount: 0, attemptCount: 0 };
  }
  assert.equal(state.expired, false, 'An expired experiment cannot become phone recovery evidence');
  assert.equal(state.reports.length, 1); assert.equal(state.operations.length, 1);
  const report = state.reports[0], operation = state.operations[0];
  assert.equal(report.id, fixture.reportId); assert.match(report.id, /^[a-f0-9]{64}$/);
  assert.equal(report.reporterUserId, fixture.parentUid); assert.equal(report.subjectType, 'other');
  for (const key of ['reason', 'description', 'emergency']) assert.equal(report[key], supportResponseGateInput[key]);
  assert.equal(report.status, 'open'); assert.equal(report.publicReplyCount, 0); assert.equal(report.lastPublicReply, null);
  assert.deepEqual(report.createdAt, report.updatedAt);
  assert.deepEqual(report, fixture.originalReport, 'Retry must not rewrite the saved request');
  assert.equal(operation.id, report.id); assert.equal(operation.reportId, report.id); assert.equal(operation.requesterUserId, fixture.parentUid);
  assert.equal(operation.clientRequestId, fixture.requestId); assert.deepEqual(operation.createdAt, report.createdAt);
  assert.deepEqual(operation, fixture.originalOperation);
  assert.equal(state.held.runId, fixture.runId); assert.equal(state.held.receipt.reportId, report.id);
  assert.equal(state.held.receipt.clientRequestId, fixture.requestId); assert.equal(state.held.receipt.reused, false);
  const confirmed = ['confirmed', 'foreign', 'restored'].includes(phase);
  assert.equal(state.attempts.length, confirmed ? 2 : 1, 'Only the observed send and explicit retry are permitted');
  const reused = state.attempts.map(row => row.receipt.reused);
  assert.equal(reused.filter(value => value === false).length, 1); assert.equal(reused.filter(Boolean).length, confirmed ? 1 : 0);
  for (const row of state.attempts) {
    assert.equal(row.runId, fixture.runId); assert.equal(row.receipt.reportId, report.id);
    assert.equal(row.receipt.requesterUserId, fixture.parentUid); assert.equal(row.receipt.clientRequestId, fixture.requestId);
    assert.equal(row.committed.originalContentVerified, true); assert.equal(row.committed.operationId, operation.id);
  }
  if (['committed', 'offline'].includes(phase)) assert.equal(state.released, null);
  else { assert.equal(state.released.runId, fixture.runId); assert.equal(state.released.reportId, report.id); assert.equal(state.released.receiptUnchanged, true); }
  assert.equal(state.requesterView.report.id, report.id); assert.equal(state.requesterView.report.emergency, true);
  assert.equal(state.requesterView.replies.items.length, 0);
  assert.doesNotMatch(JSON.stringify(state.requesterView), /digest|clientRequestId|requesterUserId|reviewNote|reviewEvents/);
  if (phase === 'foreign') {
    assert.equal(fixture.foreignReadDenied, true); assert(!state.foreignList.items.some(row => row.id === report.id));
  }
  return { phase, reportId: report.id, requestId: fixture.requestId, reportCount: 1, operationCount: 1,
    attemptCount: state.attempts.length, urgent: true, originalContentUnchanged: true };
}
