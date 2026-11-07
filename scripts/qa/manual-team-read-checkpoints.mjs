import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const teamReadPhonePhases = ['initial-unread', 'parent-read', 'new-unread', 'parent-read-again',
  'parent-sent', 'driver-unread', 'driver-read', 'parent-returned'];
export const teamReadPhoneReply = 'Reçu sans doublon QA';
export const teamReadPhoneIncoming = 'Nouveau message non lu QA';

export function verifyTeamReadPhoneCheckpoint(phase, state, fixture) {
  const index = teamReadPhonePhases.indexOf(phase);
  assert(index >= 0, 'Unknown team read checkpoint');
  const hasNew = index >= 2, hasReply = index >= 4, driverRead = index >= 6;
  const parentRead = index >= 1, parentReadAgain = index >= 3;
  const expected = [[fixture.earlyMessageId, fixture.driver.uid, 'Message avant arrivée QA'],
    [fixture.initialMessageId, fixture.driver.uid, 'Bonjour équipe QA'],
    ...(hasNew ? [[fixture.newMessageId, fixture.driver.uid, teamReadPhoneIncoming]] : []),
    ...(hasReply ? [[state.parentMessageId, fixture.parent.uid, teamReadPhoneReply]] : [])];
  assert.deepEqual(state.entries.map(row => [row.id, row.senderUserId, row.body]), expected);
  assert.deepEqual(state.entries.map(row => row.sequence), expected.map((_, at) => at + 1));
  assert.equal(new Set(state.entries.map(row => row.id)).size, expected.length);
  for (const row of state.entries) {
    assert.match(row.id, /^[a-f0-9]{64}$/); assert.match(row.clientMessageId, /^[a-f0-9-]{36}$/);
    assert(Number.isSafeInteger(row.createdAtSeconds));
    assert(Number.isSafeInteger(row.createdAtNanos) && row.createdAtNanos >= 0 && row.createdAtNanos < 1e9);
  }
  assert.equal(new Set(state.entries.map(row => row.clientMessageId)).size, expected.length);
  assert.deepEqual([...state.operationIds].sort(), state.entries.map(row => row.id).sort());
  assert.equal(state.lastSequence, expected.length);
  const expectedReceipts = [
    ...(parentRead ? [[fixture.parent.uid, fixture.initialMessageId]] : []),
    ...(parentReadAgain ? [[fixture.parent.uid, fixture.newMessageId]] : []),
    ...(driverRead ? [[fixture.driver.uid, state.parentMessageId]] : [])];
  assert.equal(state.receipts.length, expectedReceipts.length);
  for (const [uid, messageId] of expectedReceipts) {
    const id = createHash('sha256').update(JSON.stringify(['team-read-v1', uid, messageId])).digest('hex');
    const receipt = state.receipts.find(row => row.id === id);
    const message = state.entries.find(row => row.id === messageId);
    assert(receipt && message); assert.equal(receipt.userId, uid); assert.equal(receipt.messageId, messageId);
    assert.equal(receipt.messageCreatedAtSeconds, message.createdAtSeconds);
    assert.equal(receipt.messageCreatedAtNanos, message.createdAtNanos);
    assert(Number.isSafeInteger(receipt.readAtSeconds));
    assert(Number.isSafeInteger(receipt.readAtNanos) && receipt.readAtNanos >= 0 && receipt.readAtNanos < 1e9);
    assert(receipt.readAtSeconds > message.createdAtSeconds || receipt.readAtSeconds === message.createdAtSeconds &&
      receipt.readAtNanos >= message.createdAtNanos, 'A read cannot precede its message');
  }
  const counts = [!parentRead ? 1 : hasNew && !parentReadAgain ? 1 : 0,
    hasReply && !driverRead ? 1 : 0, expected.length - 1];
  const windows = [];
  for (const [at, actor] of [fixture.parent, fixture.driver, fixture.otherParent].entries()) {
    const page = state.pages[actor.uid];
    assert.equal(page.currentUserId, actor.uid); assert.equal(page.teamId, fixture.target.teamId);
    assert.equal(page.teamInstanceId, fixture.target.expectedTeamInstanceId);
    assert.equal(page.historyPolicy, 'after-current-admission'); assert.equal(page.nextCursor, null);
    assert.match(page.accessVersion, /^[a-f0-9]{64}$/); windows.push(page.accessVersion);
    const visible = at === 1 ? state.entries : state.entries.slice(1);
    const rows = page.items.toSorted((a, b) => a.sequence - b.sequence);
    assert.deepEqual(rows.map(row => [row.id, row.senderUserId, row.body, row.sequence]),
      visible.map(row => [row.id, row.senderUserId, row.body, row.sequence]));
    for (const row of rows) {
      const acknowledged = expectedReceipts.some(([uid, messageId]) => uid === actor.uid && messageId === row.id);
      assert.equal(row.needsRead, row.senderUserId !== actor.uid && !acknowledged);
    }
    assert.equal(state.counts[actor.uid], counts[at]);
  }
  assert.equal(new Set(windows).size, windows.length, 'Admission windows must remain account-bound');
  assert.equal(hasReply ? typeof state.parentMessageId : state.parentMessageId, hasReply ? 'string' : null);
  return { phase, messageCount: expected.length, receiptCount: expectedReceipts.length,
    parentUnreadCount: counts[0], driverUnreadCount: counts[1], otherParentUnreadCount: counts[2],
    identitiesAndPrivateReceiptsVerified: true, historyBeforeAdmissionExcluded: true };
}
