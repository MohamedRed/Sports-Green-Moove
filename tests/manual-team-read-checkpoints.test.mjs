import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { teamReadPhonePhases, teamReadPhoneReply, teamReadPhoneIncoming,
  verifyTeamReadPhoneCheckpoint } from '../scripts/qa/manual-team-read-checkpoints.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = { parent: { uid: 'parent' }, driver: { uid: 'driver' }, otherParent: { uid: 'other-parent' },
  target: { teamId: 'team', expectedTeamInstanceId: 'instance' },
  earlyMessageId: hash('early'), initialMessageId: hash('initial'), newMessageId: hash('new') };
function snapshot(phase) {
  const index = teamReadPhonePhases.indexOf(phase), ids = [fixture.earlyMessageId, fixture.initialMessageId,
    fixture.newMessageId, hash('reply')].slice(0, index >= 4 ? 4 : index >= 2 ? 3 : 2);
  const entries = ids.map((id, at) => ({ id, sequence: at + 1, senderUserId: at === 3 ? 'parent' : 'driver',
    body: ['Message avant arrivée QA', 'Bonjour équipe QA', teamReadPhoneIncoming, teamReadPhoneReply][at],
    clientMessageId: `${at}2345678-1234-1234-1234-123456789abc`, createdAtSeconds: 100, createdAtNanos: at }));
  const receipts = [[1, 'parent', 1], [3, 'parent', 2], [6, 'driver', 3]].filter(([at]) => index >= at)
    .map(([, uid, at]) => ({ id: hash(JSON.stringify(['team-read-v1', uid, ids[at]])), userId: uid, messageId: ids[at],
      messageCreatedAtSeconds: 100, messageCreatedAtNanos: at, readAtSeconds: 101, readAtNanos: 0 }));
  const pages = {}, counts = {};
  for (const uid of ['parent', 'driver', 'other-parent']) {
    const items = (uid === 'driver' ? entries : entries.slice(1)).toReversed().map(row => ({ ...row,
      needsRead: row.senderUserId !== uid && !receipts.some(receipt => receipt.userId === uid && receipt.messageId === row.id) }));
    pages[uid] = { currentUserId: uid, teamId: 'team', teamInstanceId: 'instance', historyPolicy: 'after-current-admission',
      nextCursor: null, accessVersion: hash(uid), items };
    counts[uid] = items.filter(row => row.needsRead).length;
  }
  return { entries, receipts, pages, counts, operationIds: ids, lastSequence: ids.length,
    parentMessageId: index >= 4 ? ids[3] : null };
}
test('all eight observed stages require exact independent unread counts and private receipts', () => {
  const expected = [[1, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 1], [0, 0, 2, 2],
    [0, 1, 3, 2], [0, 1, 3, 2], [0, 0, 3, 3], [0, 0, 3, 3]];
  for (const [index, phase] of teamReadPhonePhases.entries()) {
    const state = snapshot(phase), before = structuredClone(state);
    const receipt = verifyTeamReadPhoneCheckpoint(phase, state, fixture);
    assert.deepEqual([receipt.parentUnreadCount, receipt.driverUnreadCount, receipt.otherParentUnreadCount, receipt.receiptCount], expected[index]);
    assert.deepEqual(state, before);
  }
});
for (const [name, corrupt] of Object.entries({
  'another-account-count': state => state.counts['other-parent'] = 0,
  'own-send-count': state => state.counts.parent = 1,
  'old-history': state => state.pages.parent.items.push(state.pages.driver.items.at(-1)),
  'missing-receipt': state => state.receipts.pop(),
  'wrong-receipt-account': state => state.receipts[0].userId = 'driver',
  'wrong-receipt-id': state => state.receipts[0].id = hash('wrong'),
  'wrong-message-time': state => state.receipts[0].messageCreatedAtNanos = 5,
  'impossible-read-time': state => state.receipts[0].readAtSeconds = 99,
  'duplicate-send': state => state.entries.push(state.entries.at(-1)),
  'wrong-operation': state => state.operationIds.pop(),
  'wrong-sequence': state => state.lastSequence++,
  'wrong-window': state => state.pages.parent.accessVersion = state.pages.driver.accessVersion,
  'wrong-read-flag': state => state.pages.parent.items[0].needsRead = true,
  'unknown-parent-send': state => state.parentMessageId = null,
  'incomplete-page': state => state.pages.parent.nextCursor = 'more',
})) test(`rejects ${name}`, () => {
  const state = snapshot('parent-returned'); corrupt(state);
  assert.throws(() => verifyTeamReadPhoneCheckpoint('parent-returned', state, fixture));
});
test('a later state cannot substitute for an earlier observation', () => {
  for (const phase of teamReadPhonePhases.slice(0, 6))
    assert.throws(() => verifyTeamReadPhoneCheckpoint(phase, snapshot('parent-returned'), fixture));
  assert.throws(() => verifyTeamReadPhoneCheckpoint('unknown', snapshot('parent-returned'), fixture));
});
test('record controller never marks reads, sends parent replies or accepts physical UI on its own', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-team-read-phone-session.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /call\('markTeamChatMessagesRead'|call\('sendTeamChatMessage', fixture\.parent/);
  assert.match(source, /phoneUiProven: false/); assert.match(source, /notificationsVerified: false/);
  assert.match(source, /fixtureEnvironmentDestroyed: false/); assert.match(source, /deleteApp\(getApp\(\)\)/);
  assert.match(source, /Never retry an unknown send outcome/);
});
