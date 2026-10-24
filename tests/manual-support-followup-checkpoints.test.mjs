import assert from 'node:assert/strict';
import test from 'node:test';
import { privateSupportNote, supportFollowupInput, supportFollowupPhonePhases, supportFollowupTexts,
  verifySupportFollowupCheckpoint } from '../scripts/qa/manual-support-followup-checkpoints.mjs';
function fixtureFor(phase) {
  const count = ['submitted', 'awaiting'].includes(phase) ? 0 : phase === 'answered' ? 1 : 2;
  const status = count === 0 ? 'open' : count === 1 ? 'reviewing' : 'closed';
  const fixture = { parentUid: 'parent', adminUid: 'admin', foreignUid: 'driver', reportId: 'report',
    replyIds: ['a'.repeat(64), 'b'.repeat(64)], foreignReadDenied: true };
  const replies = supportFollowupTexts.slice(0, count).map((text, index) => ({ id: fixture.replyIds[index], text,
    sequence: index + 1, authorUid: 'admin', sentAt: { seconds: 1 } }));
  const projected = replies.map(({ authorUid, sentAt, ...row }) => ({ ...row, sentAtMillis: 1000 })).reverse();
  const state = { reports: [{ id: 'report', ...supportFollowupInput, reporterUserId: 'parent', status, publicReplyCount: count,
    reviewNote: count ? privateSupportNote : null, lastPublicReply: count ? replies.at(-1) : null }], replies, notifications: [],
    requesterView: { report: { id: 'report', status, replyCount: count, lastReply: projected[0] ?? null }, replies: { items: projected, nextCursor: null } },
    foreignList: { items: [] } };
  return { fixture, state };
}
test('eight exact follow-up checkpoints preserve their distinct scope', () => {
  assert.equal(supportFollowupPhonePhases.length, 8);
  verifySupportFollowupCheckpoint('prepared', { reports: [], replies: [], notifications: [], requesterView: null }, {});
  for (const phase of supportFollowupPhonePhases.slice(1)) {
    const { fixture, state } = fixtureFor(phase); assert.equal(verifySupportFollowupCheckpoint(phase, state, fixture).phase, phase);
  }
});
test('duplicate reports, responses and leaked private notes are rejected', () => {
  for (const change of [state => state.reports.push(state.reports[0]), state => state.replies.push(state.replies[0]),
    state => { state.requesterView.report.reviewNote = privateSupportNote; }, state => { state.reports[0].status = 'open'; },
    state => { state.requesterView.replies.items[0].text = 'wrong reply'; }, state => { state.notifications.push({ id: 'unrelated' }); }]) {
    const { fixture, state } = fixtureFor('closed'); change(state); assert.throws(() => verifySupportFollowupCheckpoint('closed', state, fixture));
  }
});
test('foreign list presence or an unverified direct-read refusal cannot pass isolation', () => {
  const { fixture, state } = fixtureFor('foreign'); state.foreignList.items.push({ id: 'report' });
  assert.throws(() => verifySupportFollowupCheckpoint('foreign', state, fixture));
  state.foreignList.items = []; fixture.foreignReadDenied = false;
  assert.throws(() => verifySupportFollowupCheckpoint('foreign', state, fixture));
});
