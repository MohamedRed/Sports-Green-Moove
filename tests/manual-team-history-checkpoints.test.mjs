import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPhonePhases, verifyHistoryPhoneCheckpoint } from '../scripts/qa/manual-team-history-checkpoints.mjs';

const identity = { parentId: 'p', managerId: 'm', childId: 'c', teamInstanceId: 'team', selfEnrollmentId: 'self', childEnrollmentId: 'child' };
function state(withdrawn = false) {
  const self = { id: 'self', requesterUserId: 'p', teamInstanceId: 'team', subjectName: null, eligible: false,
    subjectKind: 'member', subjectId: 'p', status: withdrawn ? 'withdrawn' : 'approved', revision: withdrawn ? 3 : 2, allowedActions: withdrawn ? [] : ['withdraw'] };
  const child = { ...self, id: 'child', subjectKind: 'child', subjectId: 'c', status: 'approved', revision: 2, allowedActions: [] };
  const enrollments = [self, child, ...Array.from({ length: 24 }, (_, index) => ({ id: `extra-${index}` }))];
  const events = [self, child].flatMap((row) => Array.from({ length: row.revision }, (_, index) => ({ enrollmentId: row.id,
    action: ['request', 'approve', 'withdraw'][index], revision: index + 1, actorUserId: index === 1 ? 'm' : 'p' })));
  events.push(...Array.from({ length: 24 }, (_, index) => ({ enrollmentId: `extra-${index}`, action: 'request' })));
  return { self, child, enrollments, events, first: { items: enrollments.slice(0, 20), nextCursor: 'cursor' },
    second: { items: enrollments.slice(20), nextCursor: null }, guardian: { status: 'revoked', revision: 3 },
    membership: { active: false, status: 'inactive' } };
}
test('all five checkpoint phases accept only the expected before/after persisted states', () => {
  historyPhonePhases.forEach((phase, index) => assert.equal(verifyHistoryPhoneCheckpoint(phase, state(index >= 2), identity).phase, phase));
});
test('stale post-withdrawal and premature writes fail rather than advancing a checkpoint', () => {
  assert.throws(() => verifyHistoryPhoneCheckpoint('history-withdrawn', state(), identity));
  assert.throws(() => verifyHistoryPhoneCheckpoint('history-list', state(true), identity));
});
test('child name exposure or an approved-child withdrawal action fails the checkpoint', () => {
  for (const mutate of [(s) => { s.child.subjectName = 'private'; }, (s) => { s.child.allowedActions = ['withdraw']; }]) {
    const value = state(); mutate(value); assert.throws(() => verifyHistoryPhoneCheckpoint('history-list', value, identity));
  }
});
test('duplicate, missing, or cursor-incomplete pages are rejected', () => {
  for (const mutate of [(s) => { s.second.items[0] = s.first.items[0]; }, (s) => { s.second.items.pop(); },
    (s) => { s.second.nextCursor = 'more'; }]) {
    const value = state(); mutate(value); assert.throws(() => verifyHistoryPhoneCheckpoint('history-page-2', value, identity));
  }
});
test('wrong actor, guardian authority, or restored membership cannot pass', () => {
  for (const mutate of [(s) => { s.events[1].actorUserId = 'p'; }, (s) => { s.guardian.status = 'verified'; },
    (s) => { s.membership.active = true; }]) {
    const value = state(); mutate(value); assert.throws(() => verifyHistoryPhoneCheckpoint('history-list', value, identity));
  }
});
test('unrecognized phases cannot produce a persisted result', () => {
  assert.throws(() => verifyHistoryPhoneCheckpoint('finished', state(), identity));
});
