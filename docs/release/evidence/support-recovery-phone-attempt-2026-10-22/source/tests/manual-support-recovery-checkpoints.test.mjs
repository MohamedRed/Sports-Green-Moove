import assert from 'node:assert/strict';
import test from 'node:test';
import { supportRecoveryPhases, verifySupportRecoveryCheckpoint, verifySupportLateConfirmation,
  verifySupportUnclassifiedReplay } from '../scripts/qa/manual-support-recovery-checkpoints.mjs';
import { supportResponseGateInput } from '../scripts/qa/support-submission-response-gate.mjs';
function fixture(confirmed = false) {
  const report = { id: 'a'.repeat(64), reporterUserId: supportResponseGateInput.uid, subjectType: 'other',
    reason: supportResponseGateInput.reason, description: supportResponseGateInput.description, emergency: true,
    status: 'open', publicReplyCount: 0, lastPublicReply: null, createdAt: { _seconds: 1, _nanoseconds: 0 }, updatedAt: { _seconds: 1, _nanoseconds: 0 } };
  const operation = { id: report.id, reportId: report.id, requesterUserId: report.reporterUserId, clientRequestId: 'request', createdAt: report.createdAt };
  const expected = { runId: 'run', parentUid: report.reporterUserId, reportId: report.id, requestId: 'request',
    originalReport: structuredClone(report), originalOperation: structuredClone(operation), foreignReadDenied: false };
  const attempt = { runId: 'run', receipt: { reportId: report.id, clientRequestId: 'request', requesterUserId: report.reporterUserId, reused: false },
    committed: { originalContentVerified: true, operationId: report.id } };
  return { fixture: expected, state: { reports: [report], operations: [operation], held: attempt,
    attempts: confirmed ? [attempt, { ...attempt, receipt: { ...attempt.receipt, reused: true } }] : [attempt],
    released: confirmed ? { runId: 'run', reportId: report.id, receiptUnchanged: true } : null, expired: false,
    requesterView: { report: { id: report.id, emergency: true }, replies: { items: [] } }, notifications: [], replies: [], foreignList: null } };
}
test('prepared checkpoint and ordered phases do not claim a phone network observation', () => {
  assert.equal(supportRecoveryPhases.length, 8);
  assert.deepEqual(verifySupportRecoveryCheckpoint('prepared', { notifications: [], replies: [], reports: [], operations: [], attempts: [], held: null, released: null },
    { parentUid: supportResponseGateInput.uid }), { phase: 'prepared', reportCount: 0, attemptCount: 0 });
});
test('committed request and confirmed exact retry keep their distinct receipt counts', () => {
  const first = fixture(); assert.equal(verifySupportRecoveryCheckpoint('committed', first.state, first.fixture).attemptCount, 1);
  const retry = fixture(true); assert.equal(verifySupportRecoveryCheckpoint('confirmed', retry.state, retry.fixture).attemptCount, 2);
});
for (const [name, mutate] of [
  ['duplicate report', row => row.state.reports.push(structuredClone(row.state.reports[0]))],
  ['changed identity', row => row.state.operations[0].clientRequestId = 'changed'],
  ['changed content', row => row.state.reports[0].description = 'Different'],
  ['reset timestamp', row => row.state.reports[0].updatedAt._seconds = 2],
  ['premature automatic retry', row => row.state.attempts.push(structuredClone(row.state.attempts[0]))],
  ['unexpected urgent notification', row => row.state.notifications.push({ id: 'unexpected' })],
  ['private metadata leak', row => row.state.requesterView.report.digest = 'PRIVATE'],
  ['expired gate', row => row.state.expired = true],
]) test('rejects ' + name, () => { const row = fixture(); mutate(row); assert.throws(() => verifySupportRecoveryCheckpoint('committed', row.state, row.fixture)); });
test('foreign check requires both denied direct read and an owner-scoped list', () => {
  const row = fixture(true); row.fixture.foreignReadDenied = true; row.state.foreignList = { items: [] };
  verifySupportRecoveryCheckpoint('foreign', row.state, row.fixture);
  row.state.foreignList.items.push({ id: row.fixture.reportId });
  assert.throws(() => verifySupportRecoveryCheckpoint('foreign', row.state, row.fixture));
});
test('late original confirmation is distinct from explicit retry and process restart', () => {
  const row = fixture(); row.state.released = { runId: 'run', reportId: row.fixture.reportId, receiptUnchanged: true };
  row.fixture.foreignReadDenied = true; row.state.foreignList = { items: [] };
  const result = verifySupportLateConfirmation(row.state, row.fixture);
  assert.equal(result.attemptCount, 1); assert.equal(result.explicitRetryVerified, false);
  assert.equal(result.processRestartVerified, false);
  row.state.attempts.push(structuredClone(row.state.attempts[0]));
  assert.throws(() => verifySupportLateConfirmation(row.state, row.fixture));
});
test('late confirmation still requires foreign privacy checks', () => {
  const row = fixture(); row.state.released = { runId: 'run', reportId: row.fixture.reportId, receiptUnchanged: true };
  row.state.foreignList = { items: [] };
  assert.throws(() => verifySupportLateConfirmation(row.state, row.fixture));
  row.fixture.foreignReadDenied = true; row.state.foreignList.items.push({ id: row.fixture.reportId });
  assert.throws(() => verifySupportLateConfirmation(row.state, row.fixture));
});
test('an unclassified second attempt can prove record integrity but never an explicit retry or accepted phone flow', () => {
  const row = fixture(true); row.fixture.foreignReadDenied = true; row.state.foreignList = { items: [] };
  assert.throws(() => verifySupportLateConfirmation(row.state, row.fixture));
  const result = verifySupportUnclassifiedReplay(row.state, row.fixture);
  assert.equal(result.attemptCount, 2); assert.equal(result.flowAccepted, false);
  assert.equal(result.explicitRetryVerified, false); assert.equal(result.processRestartVerified, false);
  row.state.reports.push(structuredClone(row.state.reports[0]));
  assert.throws(() => verifySupportUnclassifiedReplay(row.state, row.fixture));
});
