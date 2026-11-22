import assert from 'node:assert/strict';

export function verifyManualTeamDraftViews(driver, parent, fixture, sent) {
  for (const [page, uid] of [[driver, fixture.driver.uid], [parent, fixture.parent.uid]]) {
    assert.equal(page.currentUserId, uid); assert.equal(page.teamId, fixture.target.teamId);
    assert.equal(page.teamInstanceId, fixture.target.expectedTeamInstanceId);
    assert.equal(page.historyPolicy, 'after-current-admission'); assert.equal(page.nextCursor, null);
    assert(page.items.every(row => Number.isSafeInteger(row.sequence) && row.sequence > 0));
    assert.equal(new Set(page.items.map(row => row.sequence)).size, page.items.length);
  }
  const rows = driver.items.toSorted((a, b) => a.sequence - b.sequence);
  const visible = parent.items.toSorted((a, b) => a.sequence - b.sequence);
  assert.deepEqual(rows.map(row => [row.sequence, row.senderUserId, row.body]), [
    [1, fixture.driver.uid, 'Message avant arrivée QA'], [2, fixture.driver.uid, 'Bonjour équipe QA'],
    ...(sent ? [[3, fixture.parent.uid, 'Brouillon équipe après fermeture QA']] : []),
  ]);
  assert.equal(rows[0].id, fixture.earlyMessageId); assert.equal(rows[1].id, fixture.initialMessageId);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.deepEqual(visible, rows.slice(1));
  return sent ? rows[2].id : null;
}
