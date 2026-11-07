import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const chatNetworkPhonePhases = ['ready', 'conversation-open', 'offline-failed', 'online-before-retry',
  'parent-sent', 'reply-sent', 'reply-read', 'signed-out'];
export const chatNetworkPhoneBodies = {parent: 'Connexion rétablie, rendez-vous confirmé.', driver: 'Bien reçu après la coupure.'};
const hash = parts => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const rows = (state, name) => state.documents[name] ?? [];
const belongs = (row, name, fixture) => row.data.sourceType === 'booking' && row.data.sourceId === fixture.bookingId &&
  (name !== 'notifications' || row.data.type === 'chatMessage');

export function verifyChatNetworkPhoneCheckpoint(phase, baseline, state, fixture) {
  const index = chatNetworkPhonePhases.indexOf(phase); assert(index >= 0);
  const count = index < 4 ? 0 : index === 4 ? 1 : 2;
  assert.deepEqual(state.claims, baseline.claims, 'Account claims must stay unchanged');
  assert.deepEqual(state.liveTrips, baseline.liveTrips, 'Live trips must stay unchanged');
  const mutable = ['messages', 'notifications', 'chatInboxes'];
  const protect = input => Object.fromEntries(Object.entries(input.documents).filter(([name]) => !mutable.includes(name)));
  assert.deepEqual(protect(state), protect(baseline), 'Non-chat records must stay unchanged');
  for (const name of mutable) assert.deepEqual(rows(state, name).filter(row => !belongs(row, name, fixture)),
    rows(baseline, name).filter(row => !belongs(row, name, fixture)), 'Foreign chat records must stay unchanged: ' + name);
  for (const name of mutable) assert.equal(rows(baseline, name).filter(row => belongs(row, name, fixture)).length, 0);
  const messages = rows(state, 'messages').filter(row => belongs(row, 'messages', fixture));
  const notes = rows(state, 'notifications').filter(row => belongs(row, 'notifications', fixture));
  const inboxes = rows(state, 'chatInboxes').filter(row => belongs(row, 'chatInboxes', fixture));
  assert.equal(messages.length, count, 'Exactly one message per confirmed intent');
  assert.equal(notes.length, count, 'Exactly one notification per confirmed intent');
  assert.equal(inboxes.length, count ? 2 : 0);
  const participants = [fixture.parentUid, fixture.driverUid].sort();
  for (const message of messages) {
    const data = message.data, parentMessage = data.senderUserId === fixture.parentUid;
    assert(participants.includes(data.senderUserId));
    assert.equal(data.body, parentMessage ? chatNetworkPhoneBodies.parent : chatNetworkPhoneBodies.driver);
    assert.deepEqual([...data.participantUserIds].sort(), participants);
    assert.match(data.clientMessageId, /^[0-9a-f-]{36}$/);
    if (!parentMessage) assert.equal(data.clientMessageId, fixture.replyRequestId);
    assert.equal(message.id, hash([data.senderUserId, data.clientMessageId]));
    assert(data.readByUserIds.includes(data.senderUserId));
    assert(data.readByUserIds.every(uid => participants.includes(uid)));
    if (!parentMessage && index >= 6) assert.deepEqual([...data.readByUserIds].sort(), participants);
    const recipient = parentMessage ? fixture.driverUid : fixture.parentUid;
    const note = notes.find(row => row.id === 'chat_' + hash([message.id, recipient])); assert(note);
    assert.equal(note.data.messageId, message.id); assert.equal(note.data.userId, recipient);
    assert.equal(note.data.body, data.body);
    if (!parentMessage && index >= 6) assert.equal(note.data.read, true);
  }
  assert.equal(new Set(messages.map(row => row.data.body)).size, count, 'A retry cannot duplicate a body');
  for (const inbox of inboxes) {
    const data = inbox.data; assert(participants.includes(data.userId));
    assert.equal(inbox.id, hash([data.userId, 'booking', fixture.bookingId]));
    assert.equal(data.schemaVersion, 1); assert(data.revision >= count);
    const last = messages.find(row => row.id === data.lastMessageId); assert(last);
    assert.equal(data.lastMessageBody, last.data.body); assert.equal(data.lastSenderUserId, last.data.senderUserId);
    const unread = messages.filter(row => row.data.senderUserId !== data.userId && !row.data.readByUserIds.includes(data.userId)).length;
    assert.equal(data.unreadCount, unread);
  }
  return {phase, status: 'passed', messageCount: count, notificationCount: count,
    duplicateMessages: 0, foreignRecordsPreserved: true, accountClaimsPreserved: true,
    phoneUiProvenByObserver: false, physicalRadioLossProvenByObserver: false};
}
