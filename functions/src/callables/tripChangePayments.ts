import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { stripePublishableKeySecret, stripeSecretKeySecret } from "../lib/providerSecrets.js";
import { stripePublishableKey } from "../services/stripeConnect.js";
import { createTripChangePayment, stripeSupplementProvider } from "../services/tripChangePaymentProvider.js";
import { tripChangePaymentStatus } from "../services/tripChangePaymentPreparation.js";

const schema = z.object({ balanceId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const getTripChangePaymentStatus = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "parent");
  return tripChangePaymentStatus(parseCallableData(schema, request.data).balanceId, uid);
});
export const createTripChangePaymentIntent = onCall({ secrets: [stripeSecretKeySecret, stripePublishableKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "parent");
  const { balanceId } = parseCallableData(schema, request.data);
  const publishableKey = stripePublishableKey(stripePublishableKeySecret.value());
  const result = await createTripChangePayment(balanceId, uid, stripeSupplementProvider(stripeSecretKeySecret.value()));
  return { ...result, publishableKey };
});
