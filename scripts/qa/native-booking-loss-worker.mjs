import assert from 'node:assert/strict';
import { db } from './local-flow-client.mjs';
import { openPostCommitLossProxy } from './post-commit-loss-proxy.mjs';

assert(process.send, 'The local booking fault worker must be supervised');
const tripId = process.env.SGM_FAULT_TRIP_ID;
assert(typeof tripId === 'string' && tripId.length > 0);
const proxy = await openPostCommitLossProxy(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/requestBooking`, async (bookingId) => {
  const records = await db.collection('bookings').where('tripId', '==', tripId).get();
  assert.equal(records.size, 1);
  const booking = records.docs[0]; assert.equal(booking.id, bookingId);
  assert.equal(booking.get('parentUserId'), 'sgm-qa-parent'); assert.equal(booking.get('childId'), 'sgm-qa-child-lina');
  assert.equal(booking.get('seats'), 2); assert.equal(booking.get('status'), 'requested');
  const receipts = await db.collection('bookingRequestReceipts').where('response.bookingId', '==', bookingId).get();
  assert.equal(receipts.size, 1);
  return { bookingId, clientRequestId: receipts.docs[0].get('clientRequestId'), bookingCount: 1, receiptCount: 1,
    createdAtMillis: booking.get('createdAt').toMillis() };
});
process.send({ type: 'ready', port: proxy.port });
let closing = false;
async function close() {
  if (closing) return; closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000); deadline.unref();
  await proxy.close(); await db.terminate(); clearTimeout(deadline);
  if (process.connected) process.disconnect();
}
process.on('message', (message) => {
  if (message === 'receipt') process.send({ type: 'receipt', attempts: proxy.attempts });
  if (message === 'close') void close();
});
process.on('disconnect', () => { void close(); });
