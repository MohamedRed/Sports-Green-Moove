import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { urgentPhoneInput, urgentPhoneReply, urgentPhonePhases, verifyUrgentPhoneCheckpoint } from '../scripts/qa/manual-support-urgent-checkpoints.mjs';

function scenario(phase) {
  const createdAt = { seconds: 100, nanoseconds: 0 }, id = 'report-urgent';
  const operation = { id, reportId: id, requesterUserId: 'parent', clientRequestId: '55bed7b4-ef8b-45cb-8dfe-92f547c979c1', createdAt };
  const fixture = { parentUid: 'parent', adminUid: 'admin', reportId: id, originalCreatedAt: createdAt,
    originalOperation: structuredClone(operation), replyId: 'reply-1', foreignReadDenied: phase === 'foreign' };
  if (phase === 'prepared') return { fixture, state: { reports: [], operations: [], outbox: [], replies: [], replyOperations: [],
    notifications: [], requesterView: null, foreignList: null } };
  const count = ['submitted', 'reviewed'].includes(phase) ? 0 : 1;
  const status = phase === 'submitted' ? 'open' : ['reviewed', 'answered'].includes(phase) ? 'reviewing' : 'closed';
  const lastReply = count ? { id: fixture.replyId, text: urgentPhoneReply, sequence: 1, sentAt: createdAt } : null;
  return { fixture, state: {
    reports: [{ id, ...urgentPhoneInput, reporterUserId: 'parent', createdAt, status, publicReplyCount: count, lastPublicReply: lastReply }],
    operations: [operation], outbox: [{ id, reportId: id, kind: 'support-urgent', audience: 'support', status: 'needs_configuration', attempts: 0, createdAt }],
    replies: count ? [{ ...lastReply, authorUid: 'admin' }] : [],
    replyOperations: count ? [{ id: fixture.replyId, reportId: id, adminUid: 'admin', sequence: 1, status: 'reviewing',
      digest: createHash('sha256').update(JSON.stringify([id, urgentPhoneReply, 'reviewing', 0, 'reviewing'])).digest('hex') }] : [],
    requesterView: { report: { id, status, emergency: true, replyCount: count, lastReply }, replies: { items: count ? [lastReply] : [], nextCursor: null } },
    notifications: [], foreignList: phase === 'foreign' ? { items: [] } : null,
  } };
}
for (const phase of urgentPhonePhases) test('independent urgent record protocol accepts only its expected ' + phase + ' state', () => {
  const { state, fixture } = scenario(phase); assert.equal(verifyUrgentPhoneCheckpoint(phase, state, fixture).phase, phase);
});
for (const [name, mutate] of [
  ['duplicate report', state => state.reports.push(state.reports[0])],
  ['duplicate outbox', state => state.outbox.push(state.outbox[0])],
  ['club audience', state => state.outbox[0].audience = 'clubManager'],
  ['actual provider send', state => state.outbox[0].attempts = 1],
  ['accepted email claim', state => state.outbox[0].status = 'accepted'],
  ['recipient content', state => state.outbox[0].message = { to: ['hidden@example.test'] }],
  ['changed submission identity', state => state.operations[0].clientRequestId = 'different'],
  ['other author reply', state => state.replies[0].authorUid = 'clubManager'],
  ['wrong reply text', state => state.replies[0].text = 'different'],
  ['duplicate reply operation', state => state.replyOperations.push(state.replyOperations[0])],
  ['private note projection', state => state.requesterView.report.reviewNote = 'private'],
  ['club notice', state => state.notifications.push({ userId: 'clubManager' })],
]) test('independent urgent observer refuses ' + name, () => {
  const { state, fixture } = scenario('answered'); mutate(state);
  assert.throws(() => verifyUrgentPhoneCheckpoint('answered', state, fixture));
});
test('foreign account requires an actual denied read and empty owner list', () => {
  const { state, fixture } = scenario('foreign'); fixture.foreignReadDenied = false;
  assert.throws(() => verifyUrgentPhoneCheckpoint('foreign', state, fixture));
  fixture.foreignReadDenied = true; state.foreignList.items.push({ id: fixture.reportId });
  assert.throws(() => verifyUrgentPhoneCheckpoint('foreign', state, fixture));
});
test('observer contains no submission, review, reply, email retry as admin, device or role-write action', () => {
  const source = readFileSync('scripts/qa/manual-support-urgent-session.mjs', 'utf8');
  assert.doesNotMatch(source, /call\('(?:submitSupportReport|createReport|reviewReport|respondToReport|retryUrgentSupportEmail)'/);
  assert.doesNotMatch(source.replace('baseline.set(row.ref.path, row.data())', ''), /\.set\(|\.update\(|\.delete\(|setCustomUserClaims|spawn|execFile/);
  assert(source.includes("await denied('retryUrgentSupportEmail', manager"));
  assert(source.includes('physicalUiVerifiedByObserver: false')); assert(source.includes('originalClaimsUnchanged: true'));
});
