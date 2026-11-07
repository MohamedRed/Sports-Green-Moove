import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {chatNetworkPhoneBodies, chatNetworkPhonePhases, verifyChatNetworkPhoneCheckpoint} from '../scripts/qa/chat-network-phone-checkpoints.mjs';

const fixture = {bookingId: 'isolated-booking', parentUid: 'parent', driverUid: 'driver',
  replyRequestId: '22222222-2222-4222-8222-222222222222'};
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const baseline = {documents: {messages: [], notifications: [], chatInboxes: [], bookings: [{id: 'protected', data: {status: 'approved'}}]},
  claims: [{uid: 'outsider', claims: {roleKeys: ['parent']}}], liveTrips: {protected: {status: 'active'}}};
function stateFor(phase) {
  const index = chatNetworkPhonePhases.indexOf(phase), state = structuredClone(baseline);
  if (index < 4) return state;
  const senders = index === 4 ? ['parent'] : ['parent', 'driver'];
  for (const sender of senders) {
    const clientMessageId = sender === 'parent' ? '11111111-1111-4111-8111-111111111111' : fixture.replyRequestId;
    const id = hash([sender, clientMessageId]), body = chatNetworkPhoneBodies[sender], recipient = sender === 'parent' ? 'driver' : 'parent';
    state.documents.messages.push({id, data: {sourceType: 'booking', sourceId: fixture.bookingId, body,
      senderUserId: sender, clientMessageId, participantUserIds: ['parent', 'driver'],
      readByUserIds: sender === 'driver' && index >= 6 ? ['parent', 'driver'] : [sender]}});
    state.documents.notifications.push({id: 'chat_' + hash([id, recipient]), data: {sourceType: 'booking',
      sourceId: fixture.bookingId, type: 'chatMessage', messageId: id, userId: recipient, body, read: sender === 'driver' && index >= 6}});
  }
  const last = state.documents.messages.at(-1);
  state.documents.chatInboxes = ['parent', 'driver'].map(userId => ({id: hash([userId, 'booking', fixture.bookingId]),
    data: {sourceType: 'booking', sourceId: fixture.bookingId, userId, schemaVersion: 1, revision: senders.length,
      lastMessageId: last.id, lastMessageBody: last.data.body, lastSenderUserId: last.data.senderUserId,
      unreadCount: state.documents.messages.filter(row => row.data.senderUserId !== userId && !row.data.readByUserIds.includes(userId)).length}}));
  return state;
}
for (const phase of chatNetworkPhonePhases) test('independent phone chat state: ' + phase, () => {
  const result = verifyChatNetworkPhoneCheckpoint(phase, baseline, stateFor(phase), fixture);
  assert.equal(result.status, 'passed'); assert.equal(result.phoneUiProvenByObserver, false);
  assert.equal(result.physicalRadioLossProvenByObserver, false);
});
const reject = (phase, change, message) => {
  const state = stateFor(phase); change(state);
  assert.throws(() => verifyChatNetworkPhoneCheckpoint(phase, baseline, state, fixture), message);
};
test('an automatic send before explicit retry is rejected', () =>
  assert.throws(() => verifyChatNetworkPhoneCheckpoint('online-before-retry', baseline, stateFor('parent-sent'), fixture), /Exactly one message/));
test('a duplicated message is rejected', () => reject('parent-sent', state => state.documents.messages.push(state.documents.messages[0]), /Exactly one message/));
test('a duplicated notification is rejected', () => reject('parent-sent', state => state.documents.notifications.push(state.documents.notifications[0]), /Exactly one notification/));
test('foreign account claims are protected', () => reject('parent-sent', state => {state.claims[0].claims.roleKeys = ['admin'];}, /Account claims/));
test('bookings are protected', () => reject('parent-sent', state => {state.documents.bookings[0].data.status = 'cancelled';}, /Non-chat records/));
test('live tracking is protected', () => reject('reply-read', state => {state.liveTrips.protected.status = 'ended';}, /Live trips/));
test('a message for another conversation is rejected', () => reject('parent-sent', state => {
  state.documents.messages[0].data.sourceId = 'foreign';
}, /Foreign chat records/));
test('a falsified read badge is rejected', () => reject('reply-read', state => {state.documents.chatInboxes[0].data.unreadCount = 1;}));
test('the reply must be marked read by the parent', () => reject('reply-read', state => {state.documents.messages[1].data.readByUserIds = ['driver'];}));
