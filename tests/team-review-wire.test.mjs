import test from 'node:test';
import assert from 'node:assert/strict';
import { wire, team, item, page, operationId } from './team-review-support.mjs';

test('team and enrollment responses bind the exact current club and immutable team instance', () => {
  assert.deepEqual(wire.reviewTeam(team(), 'club'), team()); assert.deepEqual(wire.teamReview(item(), team()), item());
  const response = { ...page([item()]), teamId: 'team', teamInstanceId: team().teamInstanceId, teamName: 'Nom actuel' };
  assert.equal(wire.teamReviewPage(response, team()).teamName, 'Nom actuel');
  for (const patch of [{ clubId: 'foreign' }, { teamId: 'foreign' }, { teamInstanceId: 'c'.repeat(64) }])
    assert.throws(() => wire.teamReview({ ...item(), ...patch }, team()));
  assert.throws(() => wire.teamReviewPage({ ...response, teamInstanceId: 'c'.repeat(64) }, team()));
  assert.throws(() => wire.reviewTeam({ ...team(), clubId: 'foreign' }, 'club'));
});
test('only explicit bounded names, typed identities, revisions, statuses and capabilities are accepted', () => {
  for (const patch of [{ id: 'bad' }, { revision: 0 }, { revision: '1' }, { revision: Number.MAX_SAFE_INTEGER + 1 },
    { subjectKind: 'parent' }, { subjectId: '../path' }, { subjectName: '' }, { subjectName: undefined },
    { subjectName: 'private\u202e' }, { subjectName: 'x'.repeat(121) }, { allowedActions: ['approve', 'approve'] },
    { allowedActions: ['revoke'] }, { status: 'legacy-approved' }, { subjectName: null }])
    assert.throws(() => wire.teamReview({ ...item(), ...patch }, team()));
  const revoked = { ...item(), status: 'approved', subjectName: null, allowedActions: ['revoke'] };
  assert.deepEqual(wire.teamReview(revoked, team()), revoked);
  assert.throws(() => wire.reviewTeam({ ...team(), open: 'true' }, 'club'));
  assert.throws(() => wire.reviewTeam({ ...team(), name: undefined }, 'club'));
  assert.equal(wire.reviewTeam({ ...team(), name: null, open: false }, 'club').open, false);
});
test('bounded unique pages require an explicit valid cursor and do not coerce missing data', () => {
  const decode = (row) => wire.reviewTeam(row, 'club');
  for (const value of [{ items: [] }, { items: {}, nextCursor: null }, page(Array(21).fill(team())),
    page([team(), team()]), page([], ''), page([], '!'), page([], 'a'.repeat(16385))])
    assert.throws(() => wire.teamPage(value, decode));
  assert.deepEqual(wire.teamPage(page([team()], 'a'.repeat(3000)), decode), page([team()], 'a'.repeat(3000)));
});
test('decision receipts bind the displayed identity and exact new transition, not just a successful HTTP response', () => {
  const operation = { enrollmentId: item().id, action: 'approve', expectedRevision: 1, requestId: operationId };
  const result = { enrollmentId: item().id, teamId: 'team', teamInstanceId: team().teamInstanceId, status: 'approved', revision: 2, replayed: false };
  assert.equal(wire.teamDecisionStatus(result, item(), operation), 'approved');
  assert.equal(wire.teamDecisionStatus({ ...result, status: 'revoked', revision: 4, replayed: true }, item(), operation), 'revoked');
  for (const patch of [{ enrollmentId: 'c'.repeat(64) }, { teamId: 'foreign' }, { teamInstanceId: 'c'.repeat(64) },
    { revision: 1 }, { revision: 3 }, { revision: '2' }, { status: 'revoked' }, { replayed: 'false' }])
    assert.throws(() => wire.teamDecisionStatus({ ...result, ...patch }, item(), operation));
});
