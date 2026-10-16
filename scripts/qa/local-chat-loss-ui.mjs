import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, db, signIn, tripInput } from './local-flow-client.mjs';
import { faultMessage } from './native-chat-loss-proxy.mjs';

function nextMessage(worker, type) {
  return new Promise((resolveMessage, reject) => {
    const timer = setTimeout(() => finish(new Error('Local fault worker timed out')), 30_000);
    const onMessage = (message) => { if (message.type === type) finish(null, message); };
    const onExit = () => finish(new Error('Local fault worker exited before its receipt'));
    const finish = (error, value) => {
      clearTimeout(timer); worker.off('message', onMessage); worker.off('exit', onExit); worker.off('error', finish);
      if (error) reject(error); else resolveMessage(value);
    };
    worker.on('message', onMessage); worker.once('exit', onExit); worker.once('error', finish);
  });
}

export async function replayChatLossUi(instrument, collect, directory) {
  const { tripId } = await call('createTrip', await signIn('d@example.test'), { ...tripInput(), title: 'Trajet réponse perdue QA' });
  const { bookingId } = await call('requestBooking', await signIn('p@example.test'), { tripId, seats: 1 });
  await call('approveBooking', await signIn('d@example.test'), { bookingId });
  assert.equal((await db.collection('messages').where('sourceId', '==', bookingId).get()).size, 0);
  // Instrumentation is synchronous; the independently supervised child must keep serving its HTTP requests.
  const worker = fork(new URL('./native-chat-loss-worker.mjs', import.meta.url), [], {
    env: { ...process.env, SGM_FAULT_BOOKING_ID: bookingId }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  let receipt;
  try {
    const ready = await nextMessage(worker, 'ready');
    instrument(['LocalChatResponseLossTest'], 1, ['-e', 'faultPort', String(ready.port), '-e', 'faultBookingId', bookingId]);
    collect();
    const pending = nextMessage(worker, 'receipt'); worker.send('receipt'); receipt = (await pending).receipt;
    writeFileSync(resolve(directory, 'local-chat-loss-proxy.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    const ui = JSON.parse(readFileSync(resolve(directory, 'local-chat-loss-ui.json'), 'utf8'));
    assert.equal(ui.runId, process.env.SGM_LOCAL_RUN_ID); assert.equal(ui.sourceId, bookingId);
    assert(ui.completed && ui.initialReplyLost && ui.rejectedRetryRetained && ui.finalSendConfirmed && ui.networkRestored);
    assert.equal(receipt.runId, ui.runId); assert(!receipt.failed);
    assert.deepEqual(receipt.transitions, [{ from: 'loss', to: 'reject' }, { from: 'reject', to: 'recover' }]);
    for (const phase of ['loss', 'reject', 'recover']) assert(receipt.attempts.some((attempt) => attempt.phase === phase));
    assert.equal(new Set(receipt.attempts.map((attempt) => attempt.clientMessageId)).size, 1);
    for (const attempt of receipt.attempts) {
      assert.equal(attempt.body, faultMessage);
      if (attempt.phase === 'loss') assert(attempt.upstreamStatus === 200 && attempt.acknowledgementDropped && attempt.commit);
      if (attempt.phase === 'reject') assert(attempt.downstreamStatus === 429 && attempt.injectedRejection && !attempt.commit);
      if (attempt.phase === 'recover') assert(attempt.downstreamStatus === 200 && attempt.commit);
    }
    const original = receipt.attempts[0].commit;
    const records = await db.collection('messages').where('sourceId', '==', bookingId).get();
    const notes = await db.collection('notifications').where('sourceId', '==', bookingId).where('type', '==', 'chatMessage').get();
    assert.equal(records.size, 1); assert.equal(notes.size, 1);
    assert.equal(records.docs[0].id, original.messageId); assert.equal(notes.docs[0].id, original.notificationId);
    assert.equal(records.docs[0].get('createdAt').toMillis(), original.createdAtMillis);
    assert.equal(records.docs[0].get('clientMessageId'), original.clientMessageId);
    assert.equal(records.docs[0].get('body'), faultMessage); assert.equal(notes.docs[0].get('read'), false);
    return { method: receipt.scope, sourceId: bookingId, messageId: original.messageId,
      clientMessageId: original.clientMessageId, notificationId: original.notificationId,
      messageCount: 1, notificationCount: 1, duplicateMessages: 0, attempts: receipt.attempts.length,
      rejectedRetryRetained: true, networkRestored: true,
      limits: ['Production conversation route and SDK, hosted in a test activity; not full app navigation.',
        'Controlled local HTTP reply loss and 429 rejection, with Firestore network paused to defer its acknowledgement.',
        'No operating-system network loss, physical phone, process restart, expired token or push delivery tested.'] };
  } finally {
    if (worker.connected) {
      if (!receipt) {
        const pending = nextMessage(worker, 'receipt'); worker.send('receipt');
        try { writeFileSync(resolve(directory, 'local-chat-loss-proxy-failed.json'), JSON.stringify((await pending).receipt, null, 2)); }
        catch { /* Preserve the instrumentation failure if the worker cannot report. */ }
      }
      const exited = once(worker, 'exit'); worker.send('close'); await exited;
    }
  }
}
