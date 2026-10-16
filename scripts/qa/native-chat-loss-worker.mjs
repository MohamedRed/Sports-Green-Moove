import assert from 'node:assert/strict';
import { db } from './local-flow-client.mjs';
import { openNativeChatLossProxy } from './native-chat-loss-proxy.mjs';

assert(process.send, 'The local fault worker must be supervised');
let original;
const proxy = await openNativeChatLossProxy({ origin: process.env.FUNCTIONS_EMULATOR_ORIGIN,
  runId: process.env.SGM_LOCAL_RUN_ID, bookingId: process.env.SGM_FAULT_BOOKING_ID }, async (messageId, input) => {
  const messages = await db.collection('messages').where('sourceId', '==', input.bookingId).get();
  const notes = await db.collection('notifications').where('sourceId', '==', input.bookingId).where('type', '==', 'chatMessage').get();
  assert.equal(messages.size, 1); assert.equal(notes.size, 1);
  const record = messages.docs[0], data = record.data(), note = notes.docs[0];
  assert.equal(record.id, messageId); assert.equal(data.senderUserId, 'sgm-qa-parent');
  assert.equal(data.body, input.body); assert.equal(data.clientMessageId, input.clientMessageId);
  assert.equal(note.get('messageId'), messageId); assert.equal(note.get('userId'), 'sgm-qa-driver');
  assert.equal(note.get('read'), false);
  const commit = { messageId, notificationId: note.id, clientMessageId: data.clientMessageId,
    createdAtMillis: data.createdAt.toMillis(), messageCount: 1, notificationCount: 1, recipientUserId: 'sgm-qa-driver' };
  if (original) assert.deepEqual(commit, original, 'Retries must return the original saved record');
  original = commit;
  return commit;
});
process.send({ type: 'ready', port: proxy.port });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await proxy.close(); await db.terminate();
  if (process.connected) process.disconnect();
}
process.on('message', (message) => {
  if (message === 'receipt') process.send({ type: 'receipt', receipt: proxy.receipt });
  if (message === 'close') void close();
});
process.on('disconnect', () => { void close(); });
