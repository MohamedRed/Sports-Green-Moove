import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { geohashForLocation } from "geofire-common";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { estimateCo2SavedKg } from "../domain/co2.js";
import { applicationBalanceId, routeQuoteSchema, tripChangeBookingPrice,
  type applyTripChangeSchema, type quoteTripChangeSchema, type TripRouteQuote } from "../domain/tripChangeApplication.js";
import { tripChangeHash } from "../domain/tripChanges.js";
import type { LatLng } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { changePrecondition, changeStillCurrent, loadStoredTripChange, loadTripChangeState,
  requireTripChangeDriver } from "./tripChangeState.js";
import { writeTripChangeNotices } from "./tripChangeNotices.js";

export type TripChangeRouteProvider = { computeTripRoute(origin: LatLng, destination: LatLng, departureAt: string): Promise<TripRouteQuote> };
const storedQuoteSchema = z.object({ tripId: z.string(), proposalId: z.string(), proposalRevision: z.string(),
  actorUserId: z.string(), requestId: z.uuid(), route: routeQuoteSchema, createdAt: z.instanceof(Timestamp),
  expiresAt: z.instanceof(Timestamp) }).strict();

function quoteExpired(): never {
  throw new HttpsError("failed-precondition", "Route quote expired. Request a fresh quote explicitly.",
    { reason: "trip-change-quote-expired" });
}

async function confirmedState(tripId: string, proposalId: string, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const record = await loadStoredTripChange(transaction, tripId, proposalId);
    requireTripChangeDriver(record.change, uid);
    const state = await loadTripChangeState(transaction, tripId);
    requireTripChangeDriver(state.trip, uid);
    if (record.change.status !== "confirmed" || !changeStillCurrent(state, record.change, proposalId))
      changePrecondition("Every affected parent must confirm the current trip conditions before application.");
    return { change: record.change, terms: record.change.terms };
  });
}

export async function quoteTripChangeApplication(data: z.infer<typeof quoteTripChangeSchema>, uid: string, provider: TripChangeRouteProvider) {
  const quoteId = tripChangeHash([data.proposalId, uid, data.requestId]);
  const ref = firestore.collection("tripChangeQuotes").doc(quoteId), existing = await ref.get();
  const { terms, change } = await confirmedState(data.tripId, data.proposalId, uid);
  if (data.proposalRevision !== change.revision) throw new HttpsError("aborted", "Review the current proposal revision.");
  if (existing.exists) {
    const quote = storedQuoteSchema.parse(existing.data());
    if (quote.tripId !== data.tripId || quote.proposalRevision !== data.proposalRevision || quote.actorUserId !== uid)
      throw new HttpsError("already-exists", "Quote identity belongs to different conditions.");
    if (quote.expiresAt.toMillis() <= Date.now()) quoteExpired();
    return { ...data, quoteId, route: quote.route, expiresAt: quote.expiresAt.toDate().toISOString() };
  }
  const route = routeQuoteSchema.parse(await provider.computeTripRoute(terms.origin, terms.destination, terms.departureAt));
  return firestore.runTransaction(async (transaction) => {
    const { change: current } = await loadStoredTripChange(transaction, data.tripId, data.proposalId);
    const state = await loadTripChangeState(transaction, data.tripId), previous = await transaction.get(ref);
    if (current.driverUserId !== uid || current.status !== "confirmed" || current.revision !== data.proposalRevision ||
        !changeStillCurrent(state, current, data.proposalId)) throw new HttpsError("aborted", "Trip changed while calculating its route.");
    const prior = previous.exists ? storedQuoteSchema.parse(previous.data()) : null;
    if (prior && prior.expiresAt.toMillis() <= Date.now()) quoteExpired();
    const now = Timestamp.now(), quote = prior ?? { ...data, actorUserId: uid, route,
      createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 5 * 60_000) };
    if (!prior) transaction.create(ref, quote);
    return { ...data, quoteId, route: quote.route, expiresAt: quote.expiresAt.toDate().toISOString() };
  });
}

export async function applyConfirmedTripChange(data: z.infer<typeof applyTripChangeSchema>, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const { ref, change } = await loadStoredTripChange(transaction, data.tripId, data.proposalId);
    requireTripChangeDriver(change, uid);
    const state = await loadTripChangeState(transaction, data.tripId); requireTripChangeDriver(state.trip, uid);
    if (change.status === "applied") {
      const receipt = change.application!;
      if (receipt.requestId !== data.requestId || receipt.quoteId !== data.quoteId || receipt.proposalRevision !== data.proposalRevision)
        throw new HttpsError("already-exists", "This proposal was applied by a different request. Refresh the application receipt.");
      return { ...receipt, status: "applied", appliedAt: receipt.appliedAt.toDate().toISOString() };
    }
    if (change.status !== "confirmed" || change.revision !== data.proposalRevision || !changeStillCurrent(state, change, data.proposalId))
      changePrecondition("The confirmed proposal is no longer current. No change was applied.");
    const quoteSnap = await transaction.get(firestore.collection("tripChangeQuotes").doc(data.quoteId));
    const quote = storedQuoteSchema.safeParse(quoteSnap.data());
    if (!quote.success || quote.data.actorUserId !== uid || quote.data.tripId !== data.tripId || quote.data.proposalId !== data.proposalId ||
        quote.data.proposalRevision !== change.revision || quote.data.expiresAt.toMillis() <= Date.now() ||
        tripChangeHash([data.proposalId, uid, quote.data.requestId]) !== data.quoteId)
      changePrecondition("A current server route quote is required before application.");
    const prices = state.items.map((item) => {
      try { return tripChangeBookingPrice(item.snapshot.data(), change.originalTerms.priceCents, change.terms.priceCents); }
      catch { return changePrecondition("Booking payments require reconciliation before this change can be applied."); }
    });
    const now = Timestamp.now(), settlementRequiredCount = prices.filter((price) => price.balanceCents !== 0).length;
    const receipt = { ...data, actorUserId: uid, appliedAt: now, bookingIds: change.bookingIds, settlementRequiredCount };
    for (const [index, item] of state.items.entries()) {
      const price = prices[index], balanceId = applicationBalanceId(data.proposalId, item.snapshot.id);
      const cancelledPayment = item.snapshot.data().paymentStatus === "canceled";
      transaction.update(item.snapshot.ref, { agreedPriceCents: price.agreedPriceCents, agreedAmountCents: price.agreedAmountCents,
        tripTermsRevision: change.revision, tripChangeBalanceCents: price.balanceCents, tripChangeBalanceId: balanceId,
        ...(price.paymentPriceCents !== null ? { paymentPriceCents: price.paymentPriceCents } : {}),
        ...(cancelledPayment ? { paymentIntentId: FieldValue.delete(), paymentAttempt: FieldValue.delete(), paymentPriceCents: FieldValue.delete() } : {}),
        updatedAt: now });
      transaction.create(firestore.collection("tripChangeBalances").doc(balanceId), { bookingId: item.snapshot.id, tripId: data.tripId,
        proposalId: data.proposalId, parentUserId: item.parentUserId, driverUserId: uid, currency: "eur",
        originalPriceCents: change.originalTerms.priceCents, agreedPriceCents: change.terms.priceCents,
        paidBeforeCents: price.paidBeforeCents, agreedAmountCents: price.agreedAmountCents, balanceCents: price.balanceCents,
        state: price.state, createdAt: now, updatedAt: now });
    }
    const route = quote.data.route;
    transaction.update(state.tripRef, { ...change.terms, arrivalBy: change.terms.arrivalBy ?? FieldValue.delete(),
      pendingChangeId: FieldValue.delete(), appliedChangeId: data.proposalId, distanceKm: route.distanceMeters / 1000,
      routeDurationSeconds: route.durationSeconds, routeEncodedPolyline: route.encodedPolyline ?? FieldValue.delete(),
      regionGeohash: geohashForLocation([change.terms.origin.lat, change.terms.origin.lng]),
      co2SavedKgEstimate: estimateCo2SavedKg(route.distanceMeters, state.trip.seatsTotal + 1), updatedAt: now });
    transaction.update(ref, { status: "applied", application: receipt, updatedAt: now });
    writeTripChangeNotices(transaction, data.proposalId, { ...change, status: "applied", application: receipt }, "applied", now);
    return { ...receipt, status: "applied", appliedAt: now.toDate().toISOString() };
  });
}
