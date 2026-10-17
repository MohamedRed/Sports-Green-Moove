import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from './local-flow-client.mjs';
import { approveBooking, requestBooking } from '../../functions/lib/callables/bookings.js';
import { bookingIntentSnapshot } from '../../functions/lib/domain/bookingIntent.js';
import { previewTripChange, proposeTripChange, respondTripChange } from '../../functions/lib/services/tripChanges.js';
import { applyConfirmedTripChange, quoteTripChangeApplication } from '../../functions/lib/services/tripChangeApplication.js';

export async function applyChangesDuringBooking(trip, driverUserId) {
  const parentUserId = 'sgm-qa-consistency-existing-parent';
  const original = await requestBooking.run({ data: { tripId: trip.id, seats: 1,
    expectedBookingIntent: bookingIntentSnapshot((await trip.get()).data()) },
    auth: { uid: parentUserId, token: { roleKeys: ['parent'] } } });
  await approveBooking.run({ data: { bookingId: original.bookingId },
    auth: { uid: driverUserId, token: { roleKeys: ['driver'] } } });
  const preview = await previewTripChange(trip.id, driverUserId);
  const change = await proposeTripChange({ tripId: trip.id, expectedRevision: preview.revision,
    requestId: randomUUID(), terms: { ...preview.terms, priceCents: 900,
      departureAt: new Date(Date.parse(preview.terms.departureAt) + 3600_000).toISOString() } }, driverUserId);
  await respondTripChange({ tripId: trip.id, proposalId: change.proposalId, proposalRevision: change.revision,
    requestId: randomUUID(), decision: 'accept' }, parentUserId);
  let providerCalls = 0;
  const provider = { async computeTripRoute() { providerCalls++; return { distanceMeters: 12000, durationSeconds: 900 }; } };
  const quote = await quoteTripChangeApplication({ tripId: trip.id, proposalId: change.proposalId,
    proposalRevision: change.revision, requestId: randomUUID() }, driverUserId, provider);
  const receipt = await applyConfirmedTripChange({ tripId: trip.id, proposalId: change.proposalId,
    proposalRevision: change.revision, quoteId: quote.quoteId, requestId: randomUUID() }, driverUserId);
  const proposal = (await db.collection('tripChanges').doc(change.proposalId).get()).data();
  const booking = (await db.collection('bookings').doc(original.bookingId).get()).data();
  const savedTrip = (await trip.get()).data();
  assert.equal(proposal.status, 'applied'); assert.equal(proposal.decisions[parentUserId].decision, 'accept');
  assert.equal(savedTrip.priceCents, 900); assert.equal(savedTrip.appliedChangeId, change.proposalId);
  assert.equal(savedTrip.pendingChangeId, undefined); assert.equal(booking.agreedPriceCents, 900);
  assert.equal(booking.tripTermsRevision, change.revision); assert.deepEqual(receipt.bookingIds, [original.bookingId]);
  assert.equal(providerCalls, 1);
  return { method: 'real-local-proposal-confirmation-application', proposalId: change.proposalId,
    existingBookingId: original.bookingId, status: receipt.status, parentDecision: 'accept',
    affectedBookingIds: receipt.bookingIds, newPriceCents: savedTrip.priceCents,
    providerCalls, syntheticRoute: true, livePayment: false };
}
