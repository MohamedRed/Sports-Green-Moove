import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auth, call, db, denied, document, signIn } from './local-flow-client.mjs';
import { projectId } from './local-emulator-config.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const { reconcileStripeEvent } = await import('../../functions/lib/services/stripeReconciliation.js');
const parent = await signIn('p@example.test'), other = await signIn('c@example.test');
await auth.createUser({ uid: 'qa-payment-driver-only', email: 'payment-driver-only@example.test', password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims('qa-payment-driver-only', { roleKeys: ['driver'] });
const wrongRole = await signIn('payment-driver-only@example.test');
const bookingId = 'sgm-qa-booking-approved', paymentIntentId = 'pi_local_confirmation';
const ref = db.collection('bookings').doc(bookingId), original = await document('bookings', bookingId);
await ref.update({ paymentIntentId, paymentPriceCents: 400, paymentStatus: 'processing' });
const input = { bookingId, paymentIntentId };
const read = () => call('getRidePaymentStatus', parent, input);
const checks = [];
async function check(id, action) {
  try { await action(); checks.push({ id, status: 'passed' }); }
  catch (failure) { checks.push({ id, status: 'failed' }); throw failure; }
}
try {
  await check('delayed-confirmation-pending', async () => assert.equal((await read()).state, 'pending'));
  await check('signed-out-denied', () => denied('getRidePaymentStatus', null, input, 'UNAUTHENTICATED'));
  await check('wrong-role-denied', () => denied('getRidePaymentStatus', wrongRole, input, 'PERMISSION_DENIED'));
  await check('other-parent-denied', () => denied('getRidePaymentStatus', other, input, 'PERMISSION_DENIED'));
  await check('extra-ownership-input-denied', () => denied('getRidePaymentStatus', parent,
    { ...input, userId: parent.uid }, 'INVALID_ARGUMENT'));
  await check('paid-flag-without-receipt-unconfirmed', async () => {
    await ref.update({ paymentStatus: 'paid', amountPaidCents: 400 });
    assert.equal((await read()).state, 'review');
    await ref.update({ paymentStatus: 'processing' });
  });
  const intent = { id: paymentIntentId, amount: 400, currency: 'eur', status: 'succeeded',
    metadata: { product: 'sports-green-moove', bookingId, tripId: original.tripId,
      payerUserId: parent.uid, driverUserId: original.driverUserId, platformFeeCents: '0' } };
  const event = { id: 'evt_local_confirmation', type: 'payment_intent.succeeded', created: Math.floor(Date.now() / 1000),
    livemode: false, data: { object: intent } };
  await check('synthetic-event-recorded-once', async () => {
    await reconcileStripeEvent(event); await reconcileStripeEvent(event);
    assert.equal((await read()).state, 'recorded');
    assert.equal((await db.collection('rewardLedger').where('sourceId', '==', paymentIntentId).get()).size, 2);
    assert.equal((await db.collection('ridePaymentReceipts').where('paymentIntentId', '==', paymentIntentId).get()).size, 1);
  });
  await check('mismatched-ledger-unconfirmed', async () => {
    const ledger = db.collection('rewardLedger').doc(`${paymentIntentId}_driverEarning_${original.driverUserId}`);
    await ledger.update({ amountCents: 401 }); assert.equal((await read()).state, 'review');
    await ledger.update({ amountCents: 400 });
  });
  await check('refund-affected-record-unconfirmed', async () => {
    const receipt = db.collection('ridePaymentReceipts').doc(paymentIntentId);
    await receipt.update({ refundReservedCents: 1 }); assert.equal((await read()).state, 'review');
    await receipt.update({ refundReservedCents: 0 });
  });
  await check('unrelated-intent-unconfirmed', async () =>
    assert.equal((await call('getRidePaymentStatus', parent, { ...input, paymentIntentId: 'pi_unrelated' })).state, 'review'));
  await check('repeated-status-reads-have-no-writes-or-secret-response', async () => {
    const snapshot = async () => {
      const result = {};
      for (const collection of ['bookings', 'trips', 'ridePaymentReceipts', 'ridePaymentAttempts', 'rewardLedger', 'reports'])
        result[collection] = (await db.collection(collection).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return result;
    };
    const before = await snapshot();
    for (let index = 0; index < 3; index++) assert.deepEqual(await read(), { ...input, state: 'recorded' });
    assert.deepEqual(await snapshot(), before);
  });
} finally {
  const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
  assert(output, 'An explicit isolated evidence output is required');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ projectId, runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
    scope: 'local-emulated-services-not-phone-ui', steps: [{ id: 'ride-payment-confirmation',
      status: checks.length === 11 && checks.every((item) => item.status === 'passed') ? 'passed' : 'failed' }], checks,
    providerResponsesSynthetic: true, providerRequests: 0, nativeUi: false, physicalDevice: false,
    livePayment: false, refundIssued: false, productionDeployed: false }, null, 2) + '\n');
}
console.log('Isolated payment confirmation service checks passed.');
