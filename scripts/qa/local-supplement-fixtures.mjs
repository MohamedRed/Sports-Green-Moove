import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { viewedBooking, call, db, document, signIn, tripInput } from './local-flow-client.mjs';

export async function supplementFixtures() {
  const driver = await signIn('d@example.test'), parent = await signIn('p@example.test');
  const { prepareRidePayment, finishRidePayment } = await import('../../functions/lib/services/ridePaymentPreparation.js');
  const { reconcileStripeEvent } = await import('../../functions/lib/services/stripeReconciliation.js');
  const { buildRidePaymentIntentCreateParams } = await import('../../functions/lib/services/stripeConnect.js');
  const { quoteTripChangeApplication } = await import('../../functions/lib/services/tripChangeApplication.js');
  const change = async (fixture, priceCents) => {
    const preview = await call('getTripChangePreview', driver, { tripId: fixture.tripId });
    const proposed = await call('proposeTripChanges', driver, { tripId: fixture.tripId, requestId: randomUUID(),
      expectedRevision: preview.revision, terms: { ...preview.terms, priceCents } });
    await call('respondToTripChanges', parent, { tripId: fixture.tripId, proposalId: proposed.proposalId,
      proposalRevision: proposed.revision, requestId: randomUUID(), decision: 'accept' });
    const quote = await quoteTripChangeApplication({ tripId: fixture.tripId, proposalId: proposed.proposalId,
      proposalRevision: proposed.revision, requestId: randomUUID() }, driver.uid,
    { async computeTripRoute() { return { distanceMeters: 12000, durationSeconds: 900 }; } });
    await call('applyTripChanges', driver, { tripId: fixture.tripId, proposalId: proposed.proposalId,
      proposalRevision: proposed.revision, quoteId: quote.quoteId, requestId: randomUUID() });
    return (await document('bookings', fixture.bookingId)).tripChangeBalanceId;
  };
  const event = async (intent, type = 'payment_intent.succeeded') => {
    const id = `evt_local_${randomUUID()}`;
    await reconcileStripeEvent({ id, type, created: Math.floor(Date.now() / 1000), data: { object: intent } });
    return (await document('reports', `stripe_${id}`)).reconciliationStatus;
  };
  const create = async () => {
    const { tripId } = await call('createTrip', driver, { ...tripInput(), priceCents: 250 });
    const { bookingId } = await call('requestBooking', parent, await viewedBooking(parent, { tripId, seats: 1, childId: 'sgm-qa-child-lina' }));
    await call('approveBooking', driver, { bookingId });
    const prepared = await prepareRidePayment(bookingId, parent.uid), request = buildRidePaymentIntentCreateParams(prepared);
    const original = { ...request.params, id: `pi_local_${randomUUID()}`, status: 'succeeded', application_fee_amount: request.params.application_fee_amount ?? 0 };
    await finishRidePayment(prepared, original);
    assert.equal(await event(original), 'paymentReconciled');
    const fixture = { tripId, bookingId, original };
    return { ...fixture, balanceId: await change(fixture, 400) };
  };
  return { driver, parent, create, change, event };
}

export function syntheticSupplementProvider() {
  const intents = new Map(), keys = new Map();
  const provider = {
    async create(params, key) {
      if (keys.has(key)) {
        const existing = keys.get(key); assert.deepEqual(params, existing.params); return intents.get(existing.id);
      }
      const id = `pi_local_supplement_${randomUUID()}`;
      const intent = { ...params, id, status: 'requires_payment_method', application_fee_amount: params.application_fee_amount ?? 0,
        client_secret: 'synthetic-client-secret-not-for-evidence' };
      keys.set(key, { id, params: structuredClone(params) }); intents.set(id, intent); return intent;
    },
    async retrieve(id) { assert(intents.has(id)); return intents.get(id); },
  };
  return { provider, intents, keys, succeeded(id) {
    const intent = { ...intents.get(id), status: 'succeeded' }; intents.set(id, intent); return intent;
  } };
}
