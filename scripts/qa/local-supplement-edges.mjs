import assert from 'node:assert/strict';
import { db, document } from './local-flow-client.mjs';
import { syntheticSupplementProvider } from './local-supplement-fixtures.mjs';

export async function checkSupplementEdges({ parent, create, event }) {
  const { createTripChangePayment } = await import('../../functions/lib/services/tripChangePaymentProvider.js');
  const { prepareTripChangePayment } = await import('../../functions/lib/services/tripChangePaymentPreparation.js');
  const cancelled = await create(), fake = syntheticSupplementProvider();
  const first = await createTripChangePayment(cancelled.balanceId, parent.uid, fake.provider);
  const cancelledIntent = { ...await fake.provider.retrieve(first.paymentIntentId), status: 'canceled' };
  fake.intents.set(first.paymentIntentId, cancelledIntent);
  assert.equal(await event(cancelledIntent, 'payment_intent.canceled'), 'supplementCancelled');
  const second = await createTripChangePayment(cancelled.balanceId, parent.uid, fake.provider);
  assert.notEqual(second.paymentIntentId, first.paymentIntentId); assert.equal(fake.keys.size, 2);
  assert.equal(await event({ ...cancelledIntent, status: 'succeeded' }), 'supplementTermsMismatch');
  assert.equal((await document('bookings', cancelled.bookingId)).amountPaidCents, 250);
  const failed = await create(), failedFake = syntheticSupplementProvider();
  const failedRequest = await createTripChangePayment(failed.balanceId, parent.uid, failedFake.provider);
  assert.equal(await event(await failedFake.provider.retrieve(failedRequest.paymentIntentId), 'payment_intent.payment_failed'), 'supplementPending');
  const retry = await createTripChangePayment(failed.balanceId, parent.uid, failedFake.provider);
  assert.equal(retry.paymentIntentId, failedRequest.paymentIntentId); assert.equal(failedFake.keys.size, 1);
  assert.equal((await document('bookings', failed.bookingId)).tripChangeBalanceCents, 150);

  const missing = await create(), ref = db.collection('ridePaymentReceipts').doc(missing.original.id), original = await ref.get();
  await ref.delete();
  try { await assert.rejects(() => prepareTripChangePayment(missing.balanceId, parent.uid), (e) => e.code === 'failed-precondition'); }
  finally { await ref.set(original.data()); }
  assert.equal((await document('tripChangeBalances', missing.balanceId)).paymentAttempt, undefined);
  await ref.update({ refundReservedCents: 1 });
  try { await assert.rejects(() => prepareTripChangePayment(missing.balanceId, parent.uid), (e) => e.code === 'failed-precondition'); }
  finally { await ref.set(original.data()); }

  const other = await create(), otherFake = syntheticSupplementProvider();
  const otherRequest = await createTripChangePayment(other.balanceId, parent.uid, otherFake.provider);
  const foreignSuccess = otherFake.succeeded(otherRequest.paymentIntentId);
  await assert.rejects(() => createTripChangePayment(missing.balanceId, parent.uid,
    { async create() { return foreignSuccess; }, async retrieve() { return foreignSuccess; } }), (e) => e.code === 'failed-precondition');
  assert.equal((await document('bookings', other.bookingId)).amountPaidCents, 250);
  assert.equal((await db.collection('ridePaymentReceipts').doc(otherRequest.paymentIntentId).get()).exists, false);

  const incomplete = await create(), incompleteFake = syntheticSupplementProvider();
  await assert.rejects(() => createTripChangePayment(incomplete.balanceId, parent.uid, { ...incompleteFake.provider,
    async create(params, key) { return { ...await incompleteFake.provider.create(params, key), client_secret: null }; },
  }), (e) => e.code === 'failed-precondition');
  const resumed = await createTripChangePayment(incomplete.balanceId, parent.uid, incompleteFake.provider);
  assert.equal(resumed.status, 'pending'); assert.equal(incompleteFake.keys.size, 1);
  process.env.PLATFORM_FEE_BPS = '5000';
  try {
    const withFee = await create(), feeFake = syntheticSupplementProvider();
    const feeRequest = await createTripChangePayment(withFee.balanceId, parent.uid, feeFake.provider);
    const feeIntent = feeFake.succeeded(feeRequest.paymentIntentId);
    assert.equal(feeIntent.application_fee_amount, 75); assert.equal(await event(feeIntent), 'supplementSettled');
    assert.equal((await document('ridePaymentReceipts', feeIntent.id)).platformFeeCents, 75);
    assert.equal((await document('rewardLedger', `${feeIntent.id}_driverEarning_sgm-qa-driver`)).amountCents, 75);
  } finally { process.env.PLATFORM_FEE_BPS = '0'; }
  return { confirmedCancellationAllowsExplicitNewAttempt: true, retiredAttemptCannotSettleNewOne: true,
    failedPaymentReusesKnownIntent: true, missingOrReservedReceiptBlocksClaim: true,
    differentValidInvoiceCannotSettleOtherBalance: true, incompleteCheckoutResumesWithoutDuplicate: true,
    feeAndDriverLedgerMatchConfirmedInvoice: true };
}
