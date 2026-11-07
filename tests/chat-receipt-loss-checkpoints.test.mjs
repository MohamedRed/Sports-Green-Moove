import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {chatReceiptLossPhases, verifyChatReceiptLossCheckpoint} from '../scripts/qa/chat-receipt-loss-checkpoints.mjs';
import {chatNetworkPhoneBodies} from '../scripts/qa/chat-network-phone-checkpoints.mjs';

const fixture = {bookingId: 'isolated-booking', parentUid: 'sgm-qa-parent', driverUid: 'sgm-qa-driver'};
const clientMessageId = '11111111-1111-4111-8111-111111111111';
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const id = hash([fixture.parentUid, clientMessageId]), createdAt = {_seconds: 1793570000, _nanoseconds: 5000000};
const baseline = {documents: {messages: [], notifications: [], chatInboxes: [],
  users: [{id: fixture.driverUid, data: {displayName: 'Driver QA', updatedAt: createdAt}}],
  bookings: [{id: fixture.bookingId, data: {status: 'approved'}}]},
claims: [{uid: 'outsider', claims: {roleKeys: ['parent']}}], liveTrips: {protected: {status: 'active'}}};
const originalMessage = {id, data: {sourceType: 'booking', sourceId: fixture.bookingId,
  senderUserId: fixture.parentUid, body: chatNetworkPhoneBodies.parent, clientMessageId,
  participantUserIds: [fixture.parentUid, fixture.driverUid], readByUserIds: [fixture.parentUid], createdAt}};
const first = {phase: 'armed', clientMessageId, messageId: id, upstreamAcknowledged: true,
  upstreamStatus: 200, commitIndependentlyVerified: true, responseReleased: false};
function model(phase) {
  const index = chatReceiptLossPhases.indexOf(phase), state = structuredClone(baseline);
  const receipt = {failed: false, phase: index < 2 ? 'armed' : index <= 3 ? 'lost' : 'recover',
    attempts: index < 2 ? [] : [structuredClone(first)]};
  if (index < 2) return {state, receipt};
  const read = index >= 6, participants = [fixture.parentUid, fixture.driverUid];
  state.documents.messages = [structuredClone(originalMessage)];
  if (read) state.documents.messages[0].data.readByUserIds = participants;
  state.documents.notifications = [{id: 'chat_' + hash([id, fixture.driverUid]), data: {
    sourceType: 'booking', sourceId: fixture.bookingId, type: 'chatMessage', messageId: id,
    userId: fixture.driverUid, body: chatNetworkPhoneBodies.parent, read, createdAt}}];
  state.documents.chatInboxes = participants.map(userId => ({id: hash([userId, 'booking', fixture.bookingId]),
    data: {userId, sourceType: 'booking', sourceId: fixture.bookingId, schemaVersion: 1, revision: read ? 2 : 1,
      lastMessageId: id, lastMessageBody: chatNetworkPhoneBodies.parent, lastSenderUserId: fixture.parentUid,
      unreadCount: userId === fixture.driverUid && !read ? 1 : 0}}));
  return {state, receipt};
}
function check(phase, change = () => {}) {
  const value = model(phase); change(value);
  return verifyChatReceiptLossCheckpoint(phase, baseline, value.state, fixture, value.receipt, originalMessage);
}
for (const phase of chatReceiptLossPhases) test('records remain independently valid: ' + phase, () => {
  const result = check(phase); assert.equal(result.status, 'passed');
  assert.equal(result.phoneUiProvenByObserver, false); assert.equal(result.physicalRadioLossProvenByObserver, false);
});
test('explicit retry is optional when the listener has already reconciled the committed message', () => {
  assert.equal(check('parent-confirmed').status, 'passed');
  assert.equal(check('parent-confirmed', ({receipt}) => receipt.attempts.push({...first, phase: 'recover', responseReleased: true})).status, 'passed');
});
test('only a forward-moving driver profile timestamp is ignored', () => {
  assert.equal(check('driver-visible', ({state}) => {state.documents.users[0].data.updatedAt._seconds++;}).status, 'passed');
  assert.throws(() => check('driver-visible', ({state}) => {state.documents.users[0].data.updatedAt._seconds--;}));
  assert.throws(() => check('driver-visible', ({state}) => {state.documents.users[0].data.displayName = 'Changed';}));
});
for (const [name, change] of [
  ['a duplicate message', ({state}) => state.documents.messages.push(structuredClone(originalMessage))],
  ['a duplicate notification', ({state}) => state.documents.notifications.push(state.documents.notifications[0])],
  ['changed original timestamp', ({state}) => {state.documents.messages[0].data.createdAt._seconds++;}],
  ['changed original request identity', ({state}) => {state.documents.messages[0].data.clientMessageId = '22222222-2222-4222-8222-222222222222';}],
  ['changed booking', ({state}) => {state.documents.bookings[0].data.status = 'cancelled';}],
  ['changed foreign account claims', ({state}) => {state.claims[0].claims.roleKeys = ['admin'];}],
  ['changed live trip', ({state}) => {state.liveTrips.protected.status = 'ended';}],
  ['missing independent commit check', ({receipt}) => {receipt.attempts[0].commitIndependentlyVerified = false;}],
  ['response that was not lost', ({receipt}) => {receipt.attempts[0].responseReleased = true;}],
  ['missing server acknowledgement', ({receipt}) => {receipt.attempts[0].upstreamAcknowledged = false;}],
  ['a swallowed setup failure', ({receipt}) => {receipt.failed = true;}],
  ['advanced recovery without explicit release', ({receipt}) => {receipt.phase = 'recover';}],
]) test('rejects ' + name, () => assert.throws(() => check('receipt-lost', change)));
test('driver visibility requires both message and notification read acknowledgements', () => {
  assert.throws(() => check('driver-visible', ({state}) => {state.documents.notifications[0].data.read = false;}));
  assert.throws(() => check('driver-visible', ({state}) => {state.documents.messages[0].data.readByUserIds = [fixture.parentUid];}));
});
test('a blocked request cannot masquerade as a second upstream write', () => {
  assert.equal(check('receipt-lost', ({receipt}) => receipt.attempts.push({phase: 'lost', clientMessageId,
    blockedBeforeForwarding: true, upstreamAcknowledged: false, responseReleased: false})).status, 'passed');
  assert.throws(() => check('receipt-lost', ({receipt}) => receipt.attempts.push({phase: 'lost', clientMessageId,
    blockedBeforeForwarding: true, upstreamAcknowledged: true, responseReleased: false})));
});
