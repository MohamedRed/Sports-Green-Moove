import assert from 'node:assert/strict';
import { call, db, denied, signIn } from './local-flow-client.mjs';

export async function verifyLocalChatUi() {
  const sourceId = 'sgm-qa-booking-approved';
  const messages = await db.collection('messages').where('sourceId', '==', sourceId).get();
  const expected = new Map([
    ['Bonjour, le point de rendez-vous QA est confirmé.', 'sgm-qa-driver'],
    ['Nous serons devant le stade.', 'sgm-qa-parent'],
    ["Je vous retrouve à l'entrée du stade.", 'sgm-qa-driver'],
    ["J'arrive dans deux minutes.", 'sgm-qa-driver'],
    ["Merci, à tout à l'heure.", 'sgm-qa-parent'],
  ]);
  assert.equal(messages.size, expected.size, 'One record per actual UI/peer send');
  const keys = new Set();
  for (const doc of messages.docs) {
    const message = doc.data();
    assert.equal(message.sourceType, 'booking');
    assert.equal(message.senderUserId, expected.get(message.body));
    assert.deepEqual(new Set(message.participantUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    assert.deepEqual(new Set(message.readByUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    expected.delete(message.body);
    if (doc.id === 'sgm-qa-chat-booking') continue;
    assert.match(message.clientMessageId, /^[0-9a-f-]{36}$/);
    const key = `${message.senderUserId}:${message.clientMessageId}`;
    assert(!keys.has(key), 'No duplicate client send request');
    keys.add(key);
    const notifications = await db.collection('notifications').where('messageId', '==', doc.id).get();
    assert.equal(notifications.size, 1);
    const note = notifications.docs[0].data();
    assert.equal(note.userId, message.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
    assert.equal(note.sourceId, sourceId);
    assert.equal(note.sourceType, 'booking');
    assert.equal(note.type, 'chatMessage');
    assert.equal(note.read, true);
    assert(note.readAt?.toMillis() >= message.createdAt.toMillis());
  }
  assert.equal(expected.size, 0);
  for (const email of ['p@example.test', 'd@example.test']) {
    const actor = await signIn(email);
    const inbox = await call('getInbox', actor);
    assert.equal(inbox.inbox.chats.find((chat) => chat.sourceId === sourceId)?.unreadCount, 0);
  }
  const outsider = await signIn('outsider@example.test');
  assert.deepEqual((await call('getInbox', outsider)).inbox.chats, []);
  await denied('getChatConversation', outsider, { sourceType: 'booking', sourceId }, 'PERMISSION_DENIED');
  const history = await db.collection('messages').where('sourceId', '==', 'sgm-qa-chat-history').get();
  assert.equal(history.size, 120);
  return { sourceType: 'booking', sourceId, messageCount: messages.size, newMessageCount: keys.size,
    readNotificationCount: keys.size, historyMessageCount: history.size,
    peerDelivery: 'one authenticated local SDK send while the parent thread remained open' };
}
