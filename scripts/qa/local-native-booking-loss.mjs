import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, call, signIn, tripInput } from './local-flow-client.mjs';
import { nextFaultMessage } from './local-fault-worker-ipc.mjs';
import { stopDisposableBookingProcess } from './local-booking-process-stop.mjs';

export async function replayNativeBookingLoss({ instrument, collect, directory, adb, serial, runId }) {
  const driver = await signIn('d@example.test');
  const { tripId } = await call('createTrip', driver, { ...tripInput(), title: 'Trajet réponse de réservation perdue QA' });
  const worker = fork(new URL('./native-booking-loss-worker.mjs', import.meta.url), [], {
    env: { ...process.env, SGM_FAULT_TRIP_ID: tripId }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  try {
    const ready = await nextFaultMessage(worker, 'ready');
    const args = ['-e', 'bookingFaultPort', String(ready.port), '-e', 'bookingFaultTripId', tripId];
    instrument(['LocalBookingResponseLossTest#prepareUnconfirmedBooking'], 1, args);
    const stopped = stopDisposableBookingProcess(adb, serial, runId, directory);
    instrument(['LocalBookingResponseLossTest#recoverUnconfirmedBooking'], 1, args);
    collect();
    const pending = nextFaultMessage(worker, 'receipt'); worker.send('receipt');
    const { attempts } = await pending;
    const before = JSON.parse(readFileSync(resolve(directory, 'local-booking-loss-before.json')));
    const after = JSON.parse(readFileSync(resolve(directory, 'local-booking-loss-after.json')));
    assert.equal(before.runId, runId); assert.equal(after.runId, runId);
    assert.equal(after.completed, true); assert.equal(after.pendingClearedAfterAcknowledgement, true);
    assert.equal(before.tripId, tripId); assert.equal(after.tripId, tripId);
    assert.notEqual(before.processId, after.processId); assert.equal(after.previousProcessId, before.processId);
    assert.equal(attempts.length, 2, 'The SDK must not silently submit additional retries');
    assert.equal(attempts[0].acknowledgementDropped, true); assert.equal(attempts[1].acknowledgementDropped, false);
    assert(attempts.every((attempt) => attempt.upstreamStatus === 200));
    const original = attempts[0].commit;
    assert.equal(original.clientRequestId, before.clientRequestId); assert.equal(original.bookingId, after.bookingId);
    assert.equal(after.clientRequestId, before.clientRequestId);
    const records = await db.collection('bookings').where('tripId', '==', tripId).get();
    assert.equal(records.size, 1); assert.equal(records.docs[0].id, original.bookingId);
    assert.equal(records.docs[0].get('createdAt').toMillis(), original.createdAtMillis);
    assert.equal(records.docs[0].get('seats'), 2); assert.equal(records.docs[0].get('status'), 'requested');
    const receipt = { projectId: 'demo-sgm-local-qa', runId, scope: 'native-sdk-booking-response-loss-not-ui',
      tripId, attempts, before, stopped, after, bookingCount: 1, receiptCount: original.receiptCount,
      completed: true, livePayment: false, productionDeployed: false };
    writeFileSync(resolve(directory, 'native-booking-loss.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  } finally {
    if (worker.connected) { const exited = once(worker, 'exit'); worker.send('close'); const [code] = await exited; assert.equal(code, 0); }
  }
}
