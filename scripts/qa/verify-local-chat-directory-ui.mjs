import assert from 'node:assert/strict';
import { call, db, signIn } from './local-flow-client.mjs';

export async function verifyLocalChatDirectoryUi(fixture) {
  const messages = await db.collection('messages').where('sourceId', '==', fixture.bookingId).get();
  const expected = new Map([
    ['Bonjour, pouvons-nous confirmer le rendez-vous ?', 'sgm-qa-parent'],
    ['Oui, rendez-vous devant le stade.', 'sgm-qa-driver'],
  ]);
  assert.equal(messages.size, 2, 'Exactly two actual composer sends');
  for (const doc of messages.docs) {
    const message = doc.data();
    assert.equal(expected.get(message.body), message.senderUserId);
    expected.delete(message.body);
    assert.match(message.clientMessageId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(new Set(message.readByUserIds), new Set(['sgm-qa-parent', 'sgm-qa-driver']));
    const notes = await db.collection('notifications').where('messageId', '==', doc.id).get();
    assert.equal(notes.size, 1);
    const note = notes.docs[0].data();
    assert.equal(note.userId, message.senderUserId === 'sgm-qa-parent' ? 'sgm-qa-driver' : 'sgm-qa-parent');
    assert.equal(note.read, true);
    assert.equal(note.createdAt.toMillis(), message.createdAt.toMillis());
  }
  assert.equal(expected.size, 0);
  const latest = messages.docs.sort((a, b) => b.get('createdAt').toMillis() - a.get('createdAt').toMillis())[0];
  for (const email of ['p@example.test', 'd@example.test']) {
    const actor = await signIn(email);
    const indexes = await db.collection('chatInboxes').where('userId', '==', actor.uid).get();
    assert.equal(indexes.size, 28);
    const entry = indexes.docs.find((doc) => doc.get('sourceId') === fixture.bookingId).data();
    assert.equal(entry.unreadCount, 0);
    assert.equal(entry.lastMessageId, latest.id);
    assert.equal(entry.lastMessageAt.toMillis(), latest.get('createdAt').toMillis());
    const first = await call('listChatConversations', actor);
    const second = await call('listChatConversations', actor, { cursor: first.nextCursor });
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 8);
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.sourceId)).size, 28);
  }
  const archives = await db.collection('messages').where('sourceType', '==', 'booking').get();
  const archived = archives.docs.filter((doc) => doc.id.startsWith('sgm-qa-directory-ui-'));
  assert.equal(archived.length, 25);
  for (const doc of archived) assert.equal(doc.get('readByUserIds').includes('sgm-qa-parent'), doc.id === fixture.oldestSourceId);
  return { sourceType: 'booking', sourceId: fixture.bookingId, conversationCount: 28, archivedConversationCount: 25,
    firstPageCount: 20, secondPageCount: 8, messageCount: 2, readNotificationCount: 2,
    limitation: 'Archived conversations are seeded history; the two new messages were sent through the app.' };
}
