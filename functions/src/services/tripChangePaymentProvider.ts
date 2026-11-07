import type Stripe from "stripe";
import { HttpsError } from "firebase-functions/v2/https";
import { matchesSupplementIntent } from "../domain/tripChangePayments.js";
import { createStripeClient } from "./stripeConnect.js";
import { buildSupplementIntent } from "./tripChangePaymentParams.js";
import { prepareTripChangePayment } from "./tripChangePaymentPreparation.js";
import { reconcileTripChangePayment } from "./tripChangePaymentReconciliation.js";

export type SupplementProvider = {
  create(params: Stripe.PaymentIntentCreateParams, idempotencyKey: string): Promise<Stripe.PaymentIntent>;
  retrieve(id: string): Promise<Stripe.PaymentIntent>;
};
export function stripeSupplementProvider(secret: string): SupplementProvider {
  const stripe = createStripeClient(secret);
  return { create: (params, idempotencyKey) => stripe.paymentIntents.create(params, { idempotencyKey }),
    retrieve: (id) => stripe.paymentIntents.retrieve(id) };
}
export async function createTripChangePayment(balanceId: string, uid: string, provider: SupplementProvider) {
  const prepared = await prepareTripChangePayment(balanceId, uid), request = buildSupplementIntent(prepared);
  const intent = prepared.attempt.intentId ? await provider.retrieve(prepared.attempt.intentId)
    : await provider.create(request.params, request.idempotencyKey);
  if (!matchesSupplementIntent(intent, prepared.balanceId, { bookingId: prepared.bookingId, tripId: prepared.tripId,
    parentUserId: prepared.payerUserId, driverUserId: prepared.driverUserId, paymentAttempt: prepared.attempt }))
    throw new HttpsError("failed-precondition", "The provider returned a different supplement invoice.");
  const result = await reconcileTripChangePayment(intent);
  if (!["supplementPending", "supplementSettled"].includes(result.status) || result.closed)
    throw new HttpsError("failed-precondition", "Supplement preparation changed. Refresh its current status before retrying.");
  if (!result.settled && (typeof intent.client_secret !== "string" || !intent.client_secret))
    throw new HttpsError("failed-precondition", "The provider has not returned a usable supplement checkout.");
  return { bookingId: prepared.bookingId, balanceId, paymentIntentId: intent.id, clientSecret: result.settled ? null : intent.client_secret,
    amountCents: prepared.amountCents, currency: "eur", status: result.settled ? "settled" : "pending" };
}
