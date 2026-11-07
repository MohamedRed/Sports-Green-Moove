import assert from 'node:assert/strict';

export const supportFollowupPhonePhases = ['prepared', 'submitted', 'awaiting', 'answered', 'closed', 'reopened', 'foreign', 'restored'];
export const supportFollowupInput = Object.freeze({ subjectType: 'other', reason: 'Support suivi QA',
  description: 'Je souhaite suivre cette demande de test.', emergency: false });
export const supportFollowupTexts = Object.freeze(['Votre demande est prise en charge.', 'Votre demande est maintenant resolue.']);
export const privateSupportNote = 'INTERNAL-SUPPORT-FOLLOWUP-QA';

export function verifySupportFollowupCheckpoint(phase, state, fixture) {
  assert(supportFollowupPhonePhases.includes(phase));
  const { reports, replies, notifications, requesterView, foreignList } = state;
  assert(Array.isArray(reports) && Array.isArray(replies) && Array.isArray(notifications));
  assert.equal(notifications.length, 0, 'Do not infer push or inbox delivery from support record checks');
  if (phase === 'prepared') {
    assert.equal(reports.length, 0); assert.equal(replies.length, 0); assert.equal(requesterView, null);
    return { phase, reportCount: 0, replyCount: 0, status: null };
  }
  assert.equal(reports.length, 1, 'Exactly one UI-created report must remain');
  const report = reports[0]; assert.equal(report.id, fixture.reportId); assert.equal(report.reporterUserId, fixture.parentUid);
  for (const [key, value] of Object.entries(supportFollowupInput)) assert.equal(report[key], value, key);
  const count = ['submitted', 'awaiting'].includes(phase) ? 0 : phase === 'answered' ? 1 : 2;
  const status = count === 0 ? 'open' : count === 1 ? 'reviewing' : 'closed';
  assert.equal(report.status, status); assert.equal(report.publicReplyCount, count); assert.equal(replies.length, count);
  assert.equal(requesterView.report.id, fixture.reportId); assert.equal(requesterView.report.status, status);
  assert.equal(requesterView.report.replyCount, count); assert.equal(requesterView.replies.items.length, count);
  assert.equal(requesterView.replies.nextCursor, null);
  assert.doesNotMatch(JSON.stringify(requesterView), /INTERNAL|reviewNote|reviewEvents|authorUid|reviewedBy|digest/);
  const ordered = [...replies].sort((left, right) => left.sequence - right.sequence);
  for (const [index, row] of ordered.entries()) {
    assert.equal(row.sequence, index + 1); assert.equal(row.id, fixture.replyIds[index]); assert.equal(row.text, supportFollowupTexts[index]);
    assert.equal(row.authorUid, fixture.adminUid); assert(row.sentAt);
    const projected = requesterView.replies.items[count - 1 - index]; assert.equal(projected.id, row.id); assert.equal(projected.text, row.text);
  }
  if (count > 0) {
    assert.equal(report.reviewNote, privateSupportNote); assert.equal(report.lastPublicReply.id, fixture.replyIds.at(count - 1));
    assert.equal(requesterView.report.lastReply.id, report.lastPublicReply.id);
  } else assert.equal(report.lastPublicReply, null);
  if (phase === 'foreign') {
    assert(Array.isArray(foreignList.items)); assert(foreignList.items.every(row => row.id !== fixture.reportId));
    assert.equal(fixture.foreignReadDenied, true);
  }
  return { phase, reportId: fixture.reportId, reportCount: 1, replyCount: count, status,
    privateNotesAbsentFromRequesterView: true, foreignAccountChecked: phase === 'foreign' };
}
