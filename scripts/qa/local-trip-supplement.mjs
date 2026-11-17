import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { call, db, denied, document, signIn } from './local-flow-client.mjs';
import { supplementFixtures, syntheticSupplementProvider } from './local-supplement-fixtures.mjs';
import { checkSupplementEdges } from './local-supplement-edges.mjs';

export async function checkTripChangeSupplement() {
  const account = db.collection('stripeAccounts').doc('sgm-qa-driver'), previous = await account.get();
  await account.set({ stripeAccountId: 'acct_local_supplement_only' });
  const oldFee = process.env.PLATFORM_FEE_BPS;
  process.env.PLATFORM_FEE_BPS = '0';
  try {
    const { driver, parent, create, change, event } = await supplementFixtures();
    const { prepareTripChangePayment } = await import('../../functions/lib/services/tripChangePaymentPreparation.js');
    const { createTripChangePayment } = await import('../../functions/lib/services/tripChangePaymentProvider.js');
    const fixture = await create(), outside = await signIn('c@example.test');
    const state = await call('getTripChangePaymentStatus', parent, { balanceId: fixture.balanceId });
    assert.equal(state.state, 'paymentDue'); assert.equal(state.outstandingCents, 150);
    for (const actor of [driver, outside, null]) await denied('getTripChangePaymentStatus', actor,
      { balanceId: fixture.balanceId }, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
    await assert.rejects(() => prepareTripChangePayment(fixture.balanceId, outside.uid), (e) => e.code === 'permission-denied');
    const fake = syntheticSupplementProvider();
    const requests = await Promise.all([createTripChangePayment(fixture.balanceId, parent.uid, fake.provider),
      createTripChangePayment(fixture.balanceId, parent.uid, fake.provider)]);
    assert.equal(requests[0].paymentIntentId, requests[1].paymentIntentId); assert.equal(fake.keys.size, 1);
    assert.equal(requests[0].amountCents, 150); assert.equal(requests[0].status, 'pending');
    const pending = await document('bookings', fixture.bookingId), paymentId = requests[0].paymentIntentId;
    assert.equal(pending.amountPaidCents, 250); assert.equal(pending.tripChangeBalanceCents, 150);
    await denied('startRide', driver, { tripId: fixture.tripId }, 'FAILED_PRECONDITION');
    const baseReceipt = await document('ridePaymentReceipts', fixture.original.id);
    const success = fake.succeeded(paymentId);
    for (const fields of [{ amount: 400 }, { currency: 'usd' }, { application_fee_amount: 1 },
      { metadata: { ...success.metadata, paymentAttemptId: 'foreign' } }]) {
      assert.equal(await event({ ...success, ...fields }), 'supplementTermsMismatch');
      assert.deepEqual(await document('bookings', fixture.bookingId), pending);
    }
    const races = await Promise.allSettled([event(success), createTripChangePayment(fixture.balanceId, parent.uid, fake.provider)]);
    assert.equal(races[0].status, 'fulfilled'); assert.equal(races[0].value, 'supplementSettled');
    if (races[1].status === 'rejected') assert.equal(races[1].reason.code, 'failed-precondition');
    for (let i = 0; i < 3; i++) assert.equal(await event(success), 'supplementSettled');
    await event({ ...success, status: 'canceled' }, 'payment_intent.canceled');
    assert.equal(await event(fixture.original), 'paymentReconciled');
    const paid = await document('bookings', fixture.bookingId);
    assert.equal(paid.amountPaidCents, 400); assert.equal(paid.paymentIntentId, fixture.original.id);
    assert.equal(paid.paymentPriceCents, 250); assert.equal(paid.tripChangeBalanceCents, 0);
    assert.deepEqual(await document('ridePaymentReceipts', fixture.original.id), baseReceipt);
    assert.equal((await db.collection('ridePaymentReceipts').where('bookingId', '==', fixture.bookingId).get()).size, 2);
    assert.equal((await db.collection('rewardLedger').where('bookingId', '==', fixture.bookingId).get()).size, 4);
    assert.equal((await call('getTripChangePaymentStatus', parent, { balanceId: fixture.balanceId })).state, 'settled');
    const nextBalance = await change(fixture, 550), nextFake = syntheticSupplementProvider();
    const next = await createTripChangePayment(nextBalance, parent.uid, nextFake.provider);
    assert.equal(next.amountCents, 150); await event(nextFake.succeeded(next.paymentIntentId));
    assert.equal((await document('bookings', fixture.bookingId)).amountPaidCents, 550);
    assert.equal((await db.collection('ridePaymentReceipts').where('bookingId', '==', fixture.bookingId).get()).size, 3);
    await call('startRide', driver, { tripId: fixture.tripId });

    const closed = await create(), lateFake = syntheticSupplementProvider();
    let lateIntent;
    await assert.rejects(() => createTripChangePayment(closed.balanceId, parent.uid, {
      ...lateFake.provider, async create(params, key) {
        lateIntent = await lateFake.provider.create(params, key);
        await call('cancelBooking', parent, { bookingId: closed.bookingId }); return lateIntent;
      },
    }), (e) => e.code === 'failed-precondition');
    assert.equal(await event(lateFake.succeeded(lateIntent.id)), 'supplementSettled');
    assert.equal((await document('bookings', closed.bookingId)).status, 'cancelled');
    assert.equal((await document('bookings', closed.bookingId)).amountPaidCents, 400);
    assert.equal((await document('bookings', closed.bookingId)).refundStatus, 'pending');
    assert.equal((await document('tripChangeBalances', closed.balanceId)).state, 'cancelled');

    const loss = await create(), lostFake = syntheticSupplementProvider();
    await assert.rejects(() => createTripChangePayment(loss.balanceId, parent.uid, {
      ...lostFake.provider, async create(params, key) { await lostFake.provider.create(params, key); throw new Error('Injected lost provider reply'); },
    }), /Injected lost provider reply/);
    process.env.PLATFORM_FEE_BPS = '5000';
    const recovered = await createTripChangePayment(loss.balanceId, parent.uid, lostFake.provider);
    assert.equal(lostFake.keys.size, 1); assert.equal((await lostFake.provider.retrieve(recovered.paymentIntentId)).application_fee_amount, 0);
    process.env.PLATFORM_FEE_BPS = '0';
    const rejected = await create(), rejectedFake = syntheticSupplementProvider();
    await assert.rejects(() => createTripChangePayment(rejected.balanceId, parent.uid, {
      ...rejectedFake.provider, async create(params, key) {
        const result = await rejectedFake.provider.create(params, key); return { ...result, metadata: { ...result.metadata, balanceId: loss.balanceId } };
      },
    }), (e) => e.code === 'failed-precondition');
    assert.equal((await document('bookings', rejected.bookingId)).amountPaidCents, 250);
    const aged = await create(), unknown = await prepareTripChangePayment(aged.balanceId, parent.uid);
    await db.collection('tripChangeBalances').doc(aged.balanceId).update({ paymentAttempt: { ...unknown.attempt,
      createdAt: Timestamp.fromMillis(Date.now() - 24 * 3600_000) } });
    await assert.rejects(() => createTripChangePayment(aged.balanceId, parent.uid, syntheticSupplementProvider().provider), (e) => e.code === 'failed-precondition');
    const edges = await checkSupplementEdges({ parent, create, event });
    return { method: 'actual-local-transactional-payment-services-with-explicit-synthetic-provider', edges, originalInvoiceCents: 250,
      supplementsCents: [150, 150], finalPaidCents: 550, finalReceiptCount: 3, firstSettlementLedgerCount: 4,
      concurrentCreatesOneIntent: true, duplicateEventsOneCredit: true, originalInvoicePreserved: true,
      delayedOriginalEventPreservesTotal: true, paidStateNotDowngraded: true, settledBalancePermitsStart: true,
      cancelledBookingClosedAndRefundPending: true, lostReplyReusesFrozenFeeAndIntent: true,
      mismatchedProviderResponseDeniedBeforeReconciliation: true, agedUnknownAttemptBlocked: true,
      authenticatedStatusScoped: true, providerSynthetic: true, nativeUi: false, livePayment: false, refundIssued: false,
      refundExecutionImplemented: false, productionDeployed: false };
  } finally {
    if (previous.exists) await account.set(previous.data()); else await account.delete();
    if (oldFee === undefined) delete process.env.PLATFORM_FEE_BPS; else process.env.PLATFORM_FEE_BPS = oldFee;
  }
}
