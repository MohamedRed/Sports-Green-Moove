import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, db, signIn, call, denied, tripInput } from './local-flow-client.mjs';
import { openPostCommitLossProxy, postJsonWithoutRetry } from './post-commit-loss-proxy.mjs';

export async function checkChatResponseLoss() {
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Local response loss QA' });
  const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1 }));
  await call('approveBooking', driver, { bookingId });
  const input = { bookingId, body: 'Message enregistré malgré une réponse perdue.', clientMessageId: randomUUID() };
  const messages = () => db.collection('messages').where('sourceId', '==', bookingId).get();
  const notifications = () => db.collection('notifications').where('sourceId', '==', bookingId).where('type', '==', 'chatMessage').get();
  assert.equal((await messages()).size, 0);
  const proxy = await openPostCommitLossProxy(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/sendChatMessage`, async (messageId) => {
    const records = await messages(), notes = await notifications();
    assert.equal(records.size, 1); assert.equal(notes.size, 1);
    const first = records.docs[0], data = first.data(), note = notes.docs[0].data();
    assert.equal(first.id, messageId); assert.equal(data.body, input.body);
    assert.equal(data.clientMessageId, input.clientMessageId); assert.equal(data.senderUserId, parent.uid);
    assert.equal(note.messageId, messageId); assert.equal(note.userId, driver.uid); assert.equal(note.read, false);
    return { messageId, createdAtMillis: data.createdAt.toMillis(), notificationId: notes.docs[0].id,
      messageCount: records.size, notificationCount: notes.size, recipientUserId: note.userId };
  });
  try {
    let firstError;
    await assert.rejects(() => postJsonWithoutRetry(proxy.url, parent.token, input), (error) => {
      firstError = { code: error.code, responseReceived: error.responseReceived };
      return error.code === 'ECONNRESET' && error.responseReceived === false;
    });
    assert.equal(proxy.attempts.length, 1, 'The transport must not silently retry');
    const original = proxy.attempts[0].commit;
    assert(original && proxy.attempts[0].acknowledgementDropped);
    assert.equal((await call('getInbox', driver)).inbox.chats.find((item) => item.sourceId === bookingId).unreadCount, 1);
    for (let retry = 0; retry < 2; retry++) {
      const response = await postJsonWithoutRetry(proxy.url, parent.token, input);
      assert.equal(response.status, 200); assert.equal(response.json.result.messageId, original.messageId);
    }
    const conflict = await postJsonWithoutRetry(proxy.url, parent.token, { ...input, body: 'Un contenu différent.' });
    assert.equal(conflict.status, 409); assert.equal(conflict.json.error.status, 'ALREADY_EXISTS');
    await denied('sendChatMessage', await signIn('outsider@example.test'), input, 'PERMISSION_DENIED');
    await call('markChatMessagesRead', driver, { sourceType: 'booking', sourceId: bookingId, messageIds: [original.messageId] });
    const records = await messages(), notes = await notifications();
    assert.equal(records.size, 1); assert.equal(notes.size, 1);
    const stored = records.docs[0], data = stored.data(), note = notes.docs[0].data();
    assert.equal(stored.id, original.messageId); assert.equal(data.createdAt.toMillis(), original.createdAtMillis);
    assert.equal(data.body, input.body); assert.equal(data.clientMessageId, input.clientMessageId);
    assert.equal(notes.docs[0].id, original.notificationId); assert.equal(note.userId, driver.uid); assert.equal(note.read, true);
    assert(data.readByUserIds.includes(driver.uid)); assert(note.readAt.toMillis() >= data.createdAt.toMillis());
    assert.equal((await call('getInbox', driver)).inbox.chats.find((item) => item.sourceId === bookingId).unreadCount, 0);
    return { method: 'http-response-discarded-after-independent-commit-verification', sourceId: bookingId,
      clientMessageId: input.clientMessageId, firstError, attempts: proxy.attempts,
      messageId: stored.id, notificationId: notes.docs[0].id, createdAtMillis: data.createdAt.toMillis(),
      messageCount: records.size, notificationCount: notes.size, duplicateMessages: 0, unreadAfterRead: 0,
      changedBodyRejected: true, outsiderRejected: true,
      limits: ['Service HTTP transport only; no native composer, pending-ID restoration, physical phone or push delivery verified.'] };
  } finally { await proxy.close(); }
}
