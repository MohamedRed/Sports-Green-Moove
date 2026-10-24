import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, call, signIn, tripInput } from './local-flow-client.mjs';
import { nextFaultMessage } from './local-fault-worker-ipc.mjs';
import { assertBookingUiLoss } from './booking-ui-loss-evidence.mjs';

export async function replayBookingUiLoss({ instrument, collect, directory, runId }) {
  const driver = await signIn('d@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet reprise de demande QA' });
  const worker = fork(new URL('./native-booking-loss-worker.mjs', import.meta.url), [], {
    env: { ...process.env, SGM_FAULT_TRIP_ID: tripId }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  try {
    const ready = await nextFaultMessage(worker, 'ready');
    instrument(['LocalBookingResponseLossUiTest'], 1,
      ['-e', 'bookingFaultPort', String(ready.port), '-e', 'bookingFaultTripId', tripId]);
    collect();
    const pending = nextFaultMessage(worker, 'receipt'); worker.send('receipt');
    const { attempts } = await pending;
    const ui = JSON.parse(readFileSync(resolve(directory, 'local-booking-ui-loss.json')));
    assert.equal(ui.projectId, 'demo-sgm-local-qa'); assert.equal(ui.runId, runId); assert.equal(ui.tripId, tripId);
    assert.equal(ui.scope, 'native-search-ui-with-real-booking-sdk-and-stubbed-matching');
    for (const key of ['completed', 'sendingObservedBeforeDispatch', 'unconfirmedReplyVisible', 'retryActionVisible',
      'pendingIdentityPersisted', 'confirmedVisible', 'secondSubmissionActionAbsent', 'staleCallbackIgnored',
      'pendingClearedAfterAcknowledgement']) assert.equal(ui[key], true, key);
    assert.equal(ui.sdkCalls, 2); assert.equal(attempts.length, 2);
    assert.equal(attempts[0].acknowledgementDropped, true); assert.equal(attempts[1].acknowledgementDropped, false);
    assert(attempts.every((attempt) => attempt.upstreamStatus === 200));
    const original = attempts[0].commit;
    assert.equal(original.bookingId, ui.bookingId); assert.equal(original.clientRequestId, ui.clientRequestId);
    const bookings = await db.collection('bookings').where('tripId', '==', tripId).get();
    assert.equal(bookings.size, 1); assert.equal(bookings.docs[0].id, original.bookingId);
    assert.equal(bookings.docs[0].get('seats'), 2); assert.equal(bookings.docs[0].get('childId'), 'sgm-qa-child-lina');
    assert.equal(bookings.docs[0].get('createdAt').toMillis(), original.createdAtMillis);
    const receipts = await db.collection('bookingRequestReceipts').where('response.bookingId', '==', ui.bookingId).get();
    assert.equal(receipts.size, 1);
    const result = { projectId: 'demo-sgm-local-qa', runId, scope: ui.scope, ui, attempts,
      bookingCount: bookings.size, receiptCount: receipts.size, completed: true, livePayment: false, productionDeployed: false };
    assertBookingUiLoss(result, runId);
    writeFileSync(resolve(directory, 'booking-ui-loss.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    if (worker.connected) { const exited = once(worker, 'exit'); worker.send('close'); const [code] = await exited; assert.equal(code, 0); }
  }
}
