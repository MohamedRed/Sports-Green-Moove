import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, db, signIn, call, denied, document, tripInput } from './local-flow-client.mjs';

export async function checkChatDeliverySafety() {
  const parent = await signIn('p@example.test');
  const driver = await signIn('d@example.test');
  const outsider = await signIn('outsider@example.test');
  const { tripId } = await call('createTrip', driver, tripInput());
  const { bookingId } = await call('requestBooking', parent, await viewedBooking({ tripId, seats: 1 }));
  const ref = { sourceType: 'booking', sourceId: bookingId };
  const clientMessageId = randomUUID();
  const input = { bookingId, body: 'Rendez-vous devant le stade.', clientMessageId };
  const attempts = await Promise.all([0, 1, 2].map(() => call('sendChatMessage', parent, input)));
  assert.equal(new Set(attempts.map((item) => item.messageId)).size, 1, 'Concurrent retries must store exactly one message');
  const firstId = attempts[0].messageId;
  assert.equal((await db.collection('messages').where('sourceId', '==', bookingId).get()).size, 1);
  const notes = await db.collection('notifications').where('userId', '==', driver.uid)
    .where('sourceId', '==', bookingId).get();
  assert.equal(notes.size, 1, 'A retried send must not duplicate its recipient notification');
  assert.equal(notes.docs[0].data().messageId, firstId);
  await denied('sendChatMessage', parent, { ...input, body: 'Un autre contenu.' }, 'ALREADY_EXISTS');
  await denied('sendChatMessage', outsider, input, 'PERMISSION_DENIED');
  await denied('sendChatMessage', parent, { ...input, clientMessageId: 'not-a-uuid' }, 'INVALID_ARGUMENT');
  for (const body of [' ', 'x'.repeat(1001)]) {
    await denied('sendChatMessage', parent, { bookingId, body }, 'INVALID_ARGUMENT');
  }
  const context = await call('getChatConversation', parent, ref);
  assert.equal(context.conversation.currentUserId, parent.uid);
  await denied('getChatConversation', outsider, ref, 'PERMISSION_DENIED');
  await denied('getChatConversation', null, ref, 'UNAUTHENTICATED');
  await denied('getChatConversation', parent, { ...ref, sourceType: 'trip' }, 'INVALID_ARGUMENT');
  await denied('markChatMessagesRead', outsider, { ...ref, messageIds: [firstId] }, 'PERMISSION_DENIED');
  await call('markChatMessagesRead', driver, { ...ref, messageIds: [firstId] });
  assert((await document('messages', firstId)).readByUserIds.includes(driver.uid));
  assert.equal((await notes.docs[0].ref.get()).data().read, true);
  assert.equal((await call('getInbox', driver)).inbox.chats.find((item) => item.sourceId === bookingId).unreadCount, 0);
  const reply = await call('sendChatMessage', driver, { bookingId, body: 'Je vous attends au stade.', clientMessageId });
  assert.notEqual(reply.messageId, firstId, 'Request IDs are scoped to the sender');
  await denied('markChatMessagesRead', parent, { ...ref, messageIds: [reply.messageId, 'sgm-qa-missing-message'] }, 'NOT_FOUND');
  assert(!(await document('messages', reply.messageId)).readByUserIds.includes(parent.uid), 'Rejected read batches must be atomic');
  await call('markChatMessagesRead', parent, { ...ref, messageIds: [reply.messageId] });
  await call('markChatMessagesRead', parent, { ...ref, messageIds: [reply.messageId] });
  assert.equal((await call('getInbox', parent)).inbox.chats.find((item) => item.sourceId === bookingId).unreadCount, 0);
  await call('sendChatMessage', driver, { bookingId, body: 'Je suis arrivé.', clientMessageId: randomUUID() });
  assert.equal((await call('getInbox', parent)).inbox.chats.find((item) => item.sourceId === bookingId).unreadCount, 1,
    'A read acknowledgement must not clear a later incoming message');
  const foreignRef = { sourceType: 'booking', sourceId: 'sgm-qa-booking-approved' };
  await denied('markChatMessagesRead', parent, { ...foreignRef, messageIds: [reply.messageId] }, 'FAILED_PRECONDITION');
  await denied('markChatMessagesRead', parent, { ...ref, messageIds: [firstId, firstId] }, 'INVALID_ARGUMENT');
  await call('markChatMessagesRead', parent, { ...foreignRef, messageIds: ['sgm-qa-chat-booking'] });
  assert((await document('messages', 'sgm-qa-chat-booking')).readByUserIds.includes(parent.uid));
}
