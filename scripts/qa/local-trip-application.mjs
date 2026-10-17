import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, call, db, denied, document, signIn, tripInput } from './local-flow-client.mjs';
import { checkPaymentAttemptFence } from './local-payment-attempt-fence.mjs';

export async function checkTripChangeApplication() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test'), other = await signIn('c@example.test');
  const { quoteTripChangeApplication } = await import('../../functions/lib/services/tripChangeApplication.js');
  const { reconcileStripeEvent } = await import('../../functions/lib/services/stripeReconciliation.js');
  const create = async (priceCents = 0, paid = false) => {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), priceCents });
    const { bookingId } = await call('requestBooking', parent, await viewedBooking({ tripId, seats: 1, childId: 'sgm-qa-child-lina' }));
    await call('approveBooking', driver, { bookingId });
    if (paid) await db.collection('bookings').doc(bookingId).update({ paymentStatus: 'paid', amountPaidCents: priceCents,
      paymentIntentId: `pi_local_${bookingId}`, currency: 'eur' });
    return { tripId, bookingId };
  };
  const propose = async (fixture, priceCents, actor = parent) => {
    const preview = await call('getTripChangePreview', driver, { tripId: fixture.tripId });
    const change = await call('proposeTripChanges', driver, { tripId: fixture.tripId, requestId: randomUUID(), expectedRevision: preview.revision,
      terms: { ...preview.terms, priceCents, origin: { lat: 50.73, lng: 4.63 },
        departureAt: new Date(Date.parse(preview.terms.departureAt) + 1800_000).toISOString() } });
    const decision = { tripId: fixture.tripId, proposalId: change.proposalId, proposalRevision: change.revision, requestId: randomUUID(), decision: 'accept' };
    if (actor) await call('respondToTripChanges', actor, decision);
    return change;
  };
  let providerCalls = 0;
  const provider = { async computeTripRoute() { providerCalls++; return { distanceMeters: 12000, durationSeconds: 900 }; } };
  const quote = async (fixture, change, requestId = randomUUID()) => quoteTripChangeApplication({ tripId: fixture.tripId,
    proposalId: change.proposalId, proposalRevision: change.revision, requestId }, driver.uid, provider);
  const apply = (fixture, change, route) => ({ tripId: fixture.tripId, proposalId: change.proposalId,
    proposalRevision: change.revision, quoteId: route.quoteId, requestId: randomUUID() });

  const free = await create(), change = await propose(free, 0, null);
  const empty = { tripId: free.tripId, proposalId: change.proposalId, proposalRevision: change.revision, quoteId: 'a'.repeat(64), requestId: randomUUID() };
  await denied('applyTripChanges', driver, empty, 'FAILED_PRECONDITION');
  assert.equal(providerCalls, 0);
  await call('respondToTripChanges', parent, { tripId: free.tripId, proposalId: change.proposalId, proposalRevision: change.revision,
    requestId: randomUUID(), decision: 'accept' });
  const qid = randomUUID(), route = await quote(free, change, qid), count = providerCalls;
  assert.deepEqual(await quote(free, change, qid), route); assert.equal(providerCalls, count);
  const request = apply(free, change, route);
  for (const actor of [parent, other, null]) await denied('applyTripChanges', actor, request, actor ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED');
  await denied('applyTripChanges', driver, { ...request, quoteId: 'a'.repeat(64) }, 'FAILED_PRECONDITION');
  const receipts = await Promise.all([call('applyTripChanges', driver, request), call('applyTripChanges', driver, request)]);
  assert.deepEqual(receipts[0], receipts[1]); assert.equal(receipts[0].status, 'applied');
  const saved = await document('trips', free.tripId), booking = await document('bookings', free.bookingId);
  assert.equal(saved.pendingChangeId, undefined); assert.equal(saved.appliedChangeId, change.proposalId);
  assert.deepEqual(saved.origin, { lat: 50.73, lng: 4.63 }); assert.equal(saved.departureAt, change.terms.departureAt);
  assert.equal(saved.distanceKm, 12); assert.equal(saved.routeDurationSeconds, 900); assert.equal(saved.co2SavedKgEstimate, 6.4);
  assert.match(saved.regionGeohash, /^u15/); assert.equal(booking.tripTermsRevision, change.revision);
  assert.equal(booking.agreedPriceCents, 0); assert.equal(booking.tripChangeBalanceCents, 0);
  const parentView = await call('getTripChangeReview', parent, { tripId: free.tripId, proposalId: change.proposalId });
  assert.equal(parentView.applied, true); assert.equal(parentView.status, 'applied'); assert.deepEqual(parentView.bookingIds, [free.bookingId]);
  const notes = await db.collection('notifications').where('proposalId', '==', change.proposalId).get();
  assert.equal(notes.docs.filter((item) => item.data().title === 'Trajet modifié').length, 2);
  assert.deepEqual(await call('applyTripChanges', driver, request), receipts[0]);
  await denied('applyTripChanges', driver, { ...request, requestId: randomUUID() }, 'ALREADY_EXISTS');
  await call('startRide', driver, { tripId: free.tripId });

  const balances = [];
  for (const price of [400, 100]) {
    const paid = await create(250, true), proposed = await propose(paid, price), pricing = await quote(paid, proposed);
    const result = await call('applyTripChanges', driver, apply(paid, proposed, pricing));
    assert.equal(result.settlementRequiredCount, 1);
    const stored = await document('bookings', paid.bookingId), bill = await document('tripChangeBalances', stored.tripChangeBalanceId);
    assert.equal(stored.amountPaidCents, 250); assert.equal(stored.paymentPriceCents, 250);
    assert.equal(stored.agreedPriceCents, price); assert.equal(stored.tripChangeBalanceCents, price - 250);
    assert.equal(bill.state, price > 250 ? 'paymentDue' : 'refundDue');
    await denied('startRide', driver, { tripId: paid.tripId }, 'FAILED_PRECONDITION');
    const event = { id: `evt_local_${randomUUID()}`, type: 'payment_intent.succeeded', created: Math.floor(Date.now() / 1000),
      data: { object: { id: stored.paymentIntentId, amount: 250, currency: 'eur', metadata: { product: 'sports-green-moove',
        bookingId: paid.bookingId, tripId: paid.tripId, payerUserId: parent.uid, driverUserId: driver.uid, platformFeeCents: '0' } } } };
    await reconcileStripeEvent(event);
    assert.equal((await document('reports', `stripe_${event.id}`)).reconciliationStatus, 'paymentReconciled');
    assert.equal((await document('bookings', paid.bookingId)).tripChangeBalanceCents, price - 250);
    await denied('getTripChangePreview', driver, { tripId: paid.tripId }, 'FAILED_PRECONDITION');
    if (price > 250) await call('cancelBooking', parent, { bookingId: paid.bookingId });
    else {
      const cancellation = await call('getTripCancellation', driver, { tripId: paid.tripId });
      await call('cancelTrip', driver, { tripId: paid.tripId, expectedRevision: cancellation.revision,
        requestId: randomUUID(), reason: 'Annulation de contrôle après modification' });
    }
    assert.equal((await document('bookings', paid.bookingId)).refundStatus, 'pending');
    assert.equal((await document('bookings', paid.bookingId)).tripChangeBalanceCents, 0);
    assert.equal((await document('tripChangeBalances', stored.tripChangeBalanceId)).state, 'cancelled');
    balances.push({ agreedPriceCents: price, originalInvoiceCents: 250, balanceCents: bill.balanceCents, state: bill.state });
  }

  const stale = await create(), staleChange = await propose(stale, 0), staleQuote = await quote(stale, staleChange);
  await db.collection('tripChangeQuotes').doc(staleQuote.quoteId).update({ expiresAt: (await import('firebase-admin/firestore')).Timestamp.fromMillis(0) });
  await denied('applyTripChanges', driver, apply(stale, staleChange, staleQuote), 'FAILED_PRECONDITION');
  assert.equal((await document('trips', stale.tripId)).pendingChangeId, staleChange.proposalId);
  const cancelled = await create(), cancelledChange = await propose(cancelled, 0), cancelledQuote = await quote(cancelled, cancelledChange);
  await call('cancelBooking', parent, { bookingId: cancelled.bookingId });
  await denied('applyTripChanges', driver, apply(cancelled, cancelledChange, cancelledQuote), 'FAILED_PRECONDITION');
  const guardian = await create(), guardianChange = await propose(guardian, 0), guardianQuote = await quote(guardian, guardianChange);
  const childRef = db.collection('children').doc('sgm-qa-child-lina'), childBefore = await childRef.get();
  await childRef.update({ guardianUserIds: [] });
  try { await denied('applyTripChanges', driver, apply(guardian, guardianChange, guardianQuote), 'FAILED_PRECONDITION'); }
  finally { await childRef.set(childBefore.data()); }
  const failed = await create(), failedChange = await propose(failed, 0), failedId = randomUUID();
  const failedInput = { tripId: failed.tripId, proposalId: failedChange.proposalId, proposalRevision: failedChange.revision, requestId: failedId };
  const quotesBefore = (await db.collection('tripChangeQuotes').get()).size;
  await assert.rejects(() => quoteTripChangeApplication(failedInput, driver.uid,
    { async computeTripRoute() { throw new Error('Injected route provider outage'); } }), /Injected route provider outage/);
  assert.equal((await db.collection('tripChangeQuotes').get()).size, quotesBefore);
  await assert.rejects(() => quoteTripChangeApplication(failedInput, driver.uid, { async computeTripRoute() {
    await call('cancelBooking', parent, { bookingId: failed.bookingId }); return { distanceMeters: 12000, durationSeconds: 900 };
  } }), (error) => error.code === 'aborted');
  assert.equal((await db.collection('tripChangeQuotes').get()).size, quotesBefore);
  const foreign = await signIn('trip-change-driver@example.test');
  await denied('applyTripChanges', foreign, apply(guardian, guardianChange, guardianQuote), 'PERMISSION_DENIED');
  const unpaid = await create(250), unpaidChange = await propose(unpaid, 400), unpaidQuote = await quote(unpaid, unpaidChange);
  const unpaidInput = apply(unpaid, unpaidChange, unpaidQuote);
  const competing = await Promise.allSettled([call('applyTripChanges', driver, unpaidInput),
    call('applyTripChanges', driver, { ...unpaidInput, requestId: randomUUID() })]);
  assert.equal(competing.filter((item) => item.status === 'fulfilled').length, 1);
  await denied('startRide', driver, { tripId: unpaid.tripId }, 'FAILED_PRECONDITION');
  const fence = await checkPaymentAttemptFence({ driver, parent, create, edited: unpaid });
  return { method: 'authenticated-local-application-callables-with-explicit-injected-route-provider', tripId: free.tripId,
    receipt: receipts[0], savedTrip: { origin: saved.origin, departureAt: saved.departureAt, priceCents: saved.priceCents,
      distanceKm: saved.distanceKm, routeDurationSeconds: saved.routeDurationSeconds, co2SavedKgEstimate: saved.co2SavedKgEstimate,
      regionGeohash: saved.regionGeohash }, balances, originalInvoicesPreserved: true, paidBalanceBlocksStart: true,
    cancelledBalancesClosedWithoutRefundClaim: true, duplicateApplicationIdempotent: true, staleAndExpiredQuotesDenied: true,
    guardianChangeInvalidatesQuote: true, providerFailureLeavesNoQuote: true, changedSourceDuringQuoteRejected: true,
    foreignDriverDenied: true, competingApplicationsSingleWinner: true, unpaidEditedTripBlockedUntilPayment: true,
    fence, syntheticRouteQuote: true, syntheticPaymentEvents: true, nativeUi: false, liveMaps: false, livePayment: false,
    adjustmentExecutionImplemented: false, refundIssued: false, productionDeployed: false };
}
