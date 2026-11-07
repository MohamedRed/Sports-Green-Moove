import type { PreparedSupplement } from "../domain/tripChangePayments.js";
import { buildRidePaymentIntentCreateParams } from "./stripeConnect.js";

export function buildSupplementIntent(prepared: PreparedSupplement) {
  const request = buildRidePaymentIntentCreateParams(prepared);
  request.idempotencyKey = `tripChangePayment:${prepared.balanceId}:${prepared.attempt.id}`;
  request.params.metadata = { ...request.params.metadata, paymentPurpose: "tripChange", balanceId: prepared.balanceId };
  return request;
}
