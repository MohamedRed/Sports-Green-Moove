import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { call, db, denied, document } from './local-flow-client.mjs';

export async function checkPaymentAttemptFence({ driver, parent, create, edited }) {
  const { prepareRidePayment, finishRidePayment } = await import('../../functions/lib/services/ridePaymentPreparation.js');
  const { reconcileStripeEvent } = await import('../../functions/lib/services/stripeReconciliation.js');
  const account = db.collection('stripeAccounts').doc(driver.uid), previous = await account.get();
  await account.set({ stripeAccountId: 'acct_local_fixture_only' });
  const intent = (p, overrides = {}) => ({ id: `pi_local_${p.attemptId}`, amount: p.amountCents, currency: 'eur', status: 'requires_payment_method',
    transfer_data: { destination: p.destinationStripeAccountId }, metadata: { product: 'sports-green-moove', bookingId: p.bookingId,
      tripId: p.tripId, payerUserId: p.payerUserId, driverUserId: p.driverUserId, platformFeeCents: '0', paymentAttemptId: p.attemptId }, ...overrides });
  try {
    const editedAttempt = await prepareRidePayment(edited.bookingId, parent.uid);
    assert.equal(editedAttempt.amountCents, 400);
    assert.equal((await document('bookings', edited.bookingId)).paymentPriceCents, 400);
    const fixture = await create(250);
    const preview = await call('getTripChangePreview', driver, { tripId: fixture.tripId });
    const attempts = await Promise.all([prepareRidePayment(fixture.bookingId, parent.uid), prepareRidePayment(fixture.bookingId, parent.uid)]);
    assert.equal(attempts[0].attemptId, attempts[1].attemptId); assert.equal(attempts[0].amountCents, 250);
    await denied('getTripChangePreview', driver, { tripId: fixture.tripId }, 'FAILED_PRECONDITION');
    const before = await document('bookings', fixture.bookingId);
    await assert.rejects(() => finishRidePayment(attempts[0], intent(attempts[0], { amount: 400 })), (error) => error.code === 'failed-precondition');
    assert.deepEqual(await document('bookings', fixture.bookingId), before);
    const oldEvent = { id: `evt_local_${randomUUID()}`, type: 'payment_intent.canceled', data: { object: intent(attempts[0],
      { id: 'pi_foreign_attempt', metadata: { ...intent(attempts[0]).metadata, paymentAttemptId: 'another-attempt' } }) } };
    await reconcileStripeEvent(oldEvent);
    assert.equal((await document('reports', `stripe_${oldEvent.id}`)).reconciliationStatus, 'paymentAttemptMismatch');
    assert.deepEqual(await document('bookings', fixture.bookingId), before);
    await finishRidePayment(attempts[0], intent(attempts[0]));
    assert.equal((await prepareRidePayment(fixture.bookingId, parent.uid)).existingIntentId, intent(attempts[0]).id);
    await db.collection('bookings').doc(fixture.bookingId).update({ paymentStatus: 'paid', amountPaidCents: 250 });
    const paidBefore = await document('bookings', fixture.bookingId);
    await finishRidePayment(attempts[0], intent(attempts[0]));
    assert.deepEqual(await document('bookings', fixture.bookingId), paidBefore);
    await call('getTripChangePreview', driver, { tripId: fixture.tripId });

    const closed = await create(250), closedAttempt = await prepareRidePayment(closed.bookingId, parent.uid);
    await call('cancelBooking', parent, { bookingId: closed.bookingId });
    await assert.rejects(() => finishRidePayment(closedAttempt, intent(closedAttempt)), (error) => error.code === 'failed-precondition');
    assert.equal((await document('bookings', closed.bookingId)).status, 'cancelled');
    const late = { id: `evt_local_${randomUUID()}`, type: 'payment_intent.succeeded', created: Math.floor(Date.now() / 1000),
      data: { object: intent(closedAttempt, { status: 'succeeded' }) } };
    await reconcileStripeEvent(late);
    assert.equal((await document('bookings', closed.bookingId)).refundStatus, 'pending');
    assert.equal((await document('bookings', closed.bookingId)).status, 'cancelled');

    const cancelled = await create(250), cancelAttempt = await prepareRidePayment(cancelled.bookingId, parent.uid);
    await assert.rejects(() => finishRidePayment(cancelAttempt, intent(cancelAttempt, { status: 'canceled' })), (error) => error.code === 'failed-precondition');
    const replacement = await prepareRidePayment(cancelled.bookingId, parent.uid);
    assert.notEqual(replacement.attemptId, cancelAttempt.attemptId); assert.equal(replacement.existingIntentId, undefined);
    const aged = await document('bookings', cancelled.bookingId);
    await db.collection('bookings').doc(cancelled.bookingId).update({ paymentAttempt: { ...aged.paymentAttempt,
      createdAt: Timestamp.fromMillis(Date.now() - 24 * 3600_000) } });
    await assert.rejects(() => prepareRidePayment(cancelled.bookingId, parent.uid), (error) => error.code === 'failed-precondition');

    const legacy = await create(250);
    await db.collection('bookings').doc(legacy.bookingId).update({ paymentIntentId: 'pi_local_legacy', amountCents: 250,
      currency: 'eur', paymentStatus: 'requires_payment_method' });
    const reused = await prepareRidePayment(legacy.bookingId, parent.uid);
    assert.equal(reused.existingIntentId, 'pi_local_legacy');
    const legacyIntent = intent(reused, { id: 'pi_local_legacy' }); delete legacyIntent.metadata.paymentAttemptId;
    await finishRidePayment(reused, legacyIntent);

    const racing = await create(250), fresh = await call('getTripChangePreview', driver, { tripId: racing.tripId });
    const race = await Promise.allSettled([prepareRidePayment(racing.bookingId, parent.uid), call('proposeTripChanges', driver, {
      tripId: racing.tripId, expectedRevision: fresh.revision, requestId: randomUUID(), terms: { ...fresh.terms, priceCents: 300 } })]);
    assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
    const trip = await document('trips', racing.tripId), booking = await document('bookings', racing.bookingId);
    assert.notEqual(Boolean(trip.pendingChangeId), Boolean(booking.paymentAttempt));
    assert.equal(preview.terms.priceCents, 250);
    return { concurrentPreparationsOneAttempt: true, changedAmountRejected: true, unrelatedAttemptEventRejected: true,
      paidStateNotDowngraded: true, cancelledBookingNotReactivated: true, lateSuccessRequiresRefund: true,
      cancelledIntentReplacedExplicitly: true, agedUnknownAttemptBlocked: true, legacyIntentReused: true,
      paymentProposalRaceSingleWinner: true, editedUnpaidInvoiceUsesNewAgreedPrice: true, providerResponsesSynthetic: true };
  } finally { if (previous.exists) await account.set(previous.data()); else await account.delete(); }
}
