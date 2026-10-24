import assert from 'node:assert/strict';
import test from 'node:test';
import { supportPhoneInput, verifySupportPhoneCheckpoint as verify } from '../scripts/qa/manual-support-phone-checkpoints.mjs';

const fixture = { parentUid: 'parent', adminUid: 'admin', reportId: 'report' };
const open = () => ({ reports: [{ id: 'report', ...supportPhoneInput, reporterUserId: 'parent', status: 'open', createdAt: {}, updatedAt: {} }], notifications: [] });

test('untouched and invalid support forms do not create records', () => {
  for (const phase of ['prepared', 'invalid']) {
    assert.equal(verify(phase, { reports: [], notifications: [] }, fixture).reportCount, 0);
    assert.throws(() => verify(phase, open(), fixture));
  }
});
test('phone submission and reopened screen require the exact single original report', () => {
  for (const phase of ['submitted', 'reopened']) {
    assert.equal(verify(phase, open(), fixture).reportId, 'report');
    for (const patch of [{ reporterUserId: 'outsider' }, { id: 'replacement' }, { description: 'different' }, { emergency: true }, { status: 'closed' }]) {
      const state = open(); Object.assign(state.reports[0], patch); assert.throws(() => verify(phase, state, fixture));
    }
    const duplicate = open(); duplicate.reports.push({ ...duplicate.reports[0] }); assert.throws(() => verify(phase, duplicate, fixture));
  }
});
test('review requires both distinct admin service decisions without inventing requester feedback', () => {
  const state = open(), row = state.reports[0];
  Object.assign(row, { status: 'closed', reviewedByUserId: 'admin', reviewNote: 'Cloture du test isole.', closedAt: {}, reviewedAt: {},
    reviewEvents: [{ status: 'reviewing', reviewerUserId: 'admin', note: 'Prise en charge du test isole.' },
      { status: 'closed', reviewerUserId: 'admin', note: 'Cloture du test isole.' }] });
  assert.equal(verify('reviewed', state, fixture).requesterResponseRecorded, false);
  row.reviewEvents.pop(); assert.throws(() => verify('reviewed', state, fixture));
  assert.throws(() => verify('reopened', { ...open(), notifications: [{ id: 'unrelated' }] }, fixture));
  assert.throws(() => verify('unknown', open(), fixture));
});
