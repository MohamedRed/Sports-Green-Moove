import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const urgentPhonePhases = ['prepared', 'submitted', 'reviewed', 'answered', 'closed', 'reopened', 'foreign', 'restored'];
export const urgentPhoneInput = Object.freeze({ subjectType: 'other', reason: 'Support urgent QA',
  description: 'Je souhaite une reponse pour cette urgence de test.', emergency: true });
export const urgentPhoneReply = 'Votre demande urgente est bien prise en charge.';

export function verifyUrgentPhoneCheckpoint(phase, state, fixture) {
  assert(urgentPhonePhases.includes(phase));
  const { reports, operations, outbox, replies, replyOperations, requesterView, notifications, foreignList } = state;
  for (const rows of [reports, operations, outbox, replies, replyOperations, notifications]) assert(Array.isArray(rows));
  assert.equal(notifications.length, 0, 'This trial must not create a club or push notification');
  if (phase === 'prepared') {
    for (const rows of [reports, operations, outbox, replies, replyOperations]) assert.equal(rows.length, 0);
    assert.equal(requesterView, null);
    return { phase, reportCount: 0, replyCount: 0, providerAttempts: 0 };
  }
  assert.equal(reports.length, 1); assert.equal(operations.length, 1); assert.equal(outbox.length, 1);
  const report = reports[0], operation = operations[0], email = outbox[0];
  assert.equal(report.id, fixture.reportId); assert.equal(report.reporterUserId, fixture.parentUid);
  for (const [key, value] of Object.entries(urgentPhoneInput)) assert.equal(report[key], value, key);
  assert.equal(operation.id, report.id); assert.equal(operation.reportId, report.id);
  assert.equal(operation.requesterUserId, fixture.parentUid); assert.match(operation.clientRequestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(operation, fixture.originalOperation); assert.deepEqual(report.createdAt, fixture.originalCreatedAt);
  assert.equal(email.id, report.id); assert.equal(email.reportId, report.id); assert.equal(email.kind, 'support-urgent');
  assert.equal(email.audience, 'support'); assert.equal(email.status, 'needs_configuration'); assert.equal(email.attempts, 0);
  assert.deepEqual(email.createdAt, report.createdAt);
  for (const field of ['providerId', 'providerAcceptedAt', 'message', 'firstAttemptAt']) assert.equal(email[field], undefined);
  const count = ['submitted', 'reviewed'].includes(phase) ? 0 : 1;
  const status = phase === 'submitted' ? 'open' : ['reviewed', 'answered'].includes(phase) ? 'reviewing' : 'closed';
  assert.equal(report.status, status); assert.equal(report.publicReplyCount, count);
  assert.equal(replies.length, count); assert.equal(replyOperations.length, count);
  assert.equal(requesterView.report.id, report.id); assert.equal(requesterView.report.emergency, true);
  assert.equal(requesterView.report.status, status); assert.equal(requesterView.report.replyCount, count);
  assert.equal(requesterView.replies.items.length, count); assert.equal(requesterView.replies.nextCursor, null);
  assert.doesNotMatch(JSON.stringify(requesterView), /reviewNote|reviewEvents|authorUid|reviewedBy|digest|providerId|audience|leaseId/);
  if (count) {
    const reply = replies[0], receipt = replyOperations[0];
    assert.equal(reply.id, fixture.replyId); assert.equal(reply.authorUid, fixture.adminUid);
    assert.equal(reply.text, urgentPhoneReply); assert.equal(reply.sequence, 1); assert(reply.sentAt);
    assert.equal(receipt.id, reply.id); assert.equal(receipt.reportId, report.id); assert.equal(receipt.adminUid, fixture.adminUid);
    assert.equal(receipt.status, 'reviewing'); assert.equal(receipt.sequence, 1);
    assert.equal(receipt.digest, createHash('sha256').update(JSON.stringify([report.id, urgentPhoneReply, 'reviewing', 0, 'reviewing'])).digest('hex'));
    assert.equal(report.lastPublicReply.id, reply.id); assert.equal(requesterView.report.lastReply.id, reply.id);
    assert.equal(requesterView.replies.items[0].id, reply.id); assert.equal(requesterView.replies.items[0].text, urgentPhoneReply);
  } else assert.equal(report.lastPublicReply, null);
  if (phase === 'foreign') {
    assert.equal(fixture.foreignReadDenied, true); assert.equal(foreignList.items.length, 0);
  }
  return { phase, reportId: report.id, reportCount: 1, replyCount: count, status,
    providerAttempts: 0, emailStatus: email.status, supportOnlyAudience: true, privateFieldsAbsentFromRequesterView: true };
}
