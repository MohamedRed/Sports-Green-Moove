import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyManualTeamDraftViews } from '../scripts/qa/manual-team-draft-views.mjs';

const fixture = { driver: { uid: 'driver' }, parent: { uid: 'parent' },
  target: { teamId: 'team', expectedTeamInstanceId: 'instance' }, earlyMessageId: 'early', initialMessageId: 'shared' };
function pages(sent = false) {
  const rows = [
    { id: 'early', sequence: 1, senderUserId: 'driver', body: 'Message avant arrivée QA' },
    { id: 'shared', sequence: 2, senderUserId: 'driver', body: 'Bonjour équipe QA' },
    ...(sent ? [{ id: 'sent', sequence: 3, senderUserId: 'parent', body: 'Brouillon équipe après fermeture QA' }] : []),
  ];
  const base = { teamId: 'team', teamInstanceId: 'instance', historyPolicy: 'after-current-admission', nextCursor: null };
  return [{ ...base, currentUserId: 'driver', items: rows.toReversed().map(row =>
    ({ ...row, needsRead: row.senderUserId !== 'driver' })) },
  { ...base, currentUserId: 'parent', items: rows.slice(1).toReversed().map(row =>
    ({ ...row, needsRead: row.senderUserId !== 'parent' })) }];
}
test('the actual newest-first service order is checked by sequence, without mutating either page', () => {
  for (const sent of [false, true]) {
    const [driver, parent] = pages(sent), before = structuredClone([driver, parent]);
    assert.equal(verifyManualTeamDraftViews(driver, parent, fixture, sent), sent ? 'sent' : null);
    assert.deepEqual([driver, parent], before);
  }
});
test('read flags belong to each viewer while the shared message content stays identical', () => {
  const [driver, parent] = pages(true);
  assert.equal(driver.items[0].needsRead, true);
  assert.equal(parent.items[0].needsRead, false);
  assert.equal(parent.items[1].needsRead, true);
  assert.equal(verifyManualTeamDraftViews(driver, parent, fixture, true), 'sent');
  parent.items[1].needsRead = false;
  assert.equal(verifyManualTeamDraftViews(driver, parent, fixture, true), 'sent');
});
test('missing, invalid and own-message read flags are rejected', () => {
  for (const mutate of [
    d => delete d.items[0].needsRead,
    d => d.items[0].needsRead = 'true',
    d => d.items[1].needsRead = true,
    (d, p) => p.items[0].needsRead = true,
  ]) {
    const [driver, parent] = pages(true); mutate(driver, parent);
    assert.throws(() => verifyManualTeamDraftViews(driver, parent, fixture, true));
  }
});
test('history leakage, wrong actors, duplicates, pagination and an unexpected send are rejected', () => {
  for (const mutate of [
    (d, p) => p.items.push(d.items.at(-1)), (d, p) => p.currentUserId = 'driver',
    d => d.items[0].sequence = 1, d => d.nextCursor = 'more', d => d.teamInstanceId = 'other',
    (d, p) => p.items[0].body = 'different body',
  ]) {
    const [driver, parent] = structuredClone(pages()); mutate(driver, parent);
    assert.throws(() => verifyManualTeamDraftViews(driver, parent, fixture, false));
  }
  assert.throws(() => verifyManualTeamDraftViews(...pages(true), fixture, false));
  assert.throws(() => verifyManualTeamDraftViews(...pages(), fixture, true));
});
