import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  connectedAccountFromRecord,
  createConnectedAccount,
  createRewardPayoutTransfer,
  createRideDestinationPaymentIntent,
  stripePublishableKey,
  createStripeClient,
} from "../services/stripeConnect.js";
import { prepareRidePayment, finishRidePayment } from "../services/ridePaymentPreparation.js";
import { payoutResult, rewardPayoutInput } from "../domain/rewardPayout.js";
import { reserveRewardPayout, finishRewardPayout } from "../services/rewardPayout.js";
import { firestore } from "../lib/firebase.js";
import { requireAdmin, requireAuth, requireRole } from "../lib/https.js";
import { stripePublishableKeySecret, stripeSecretKeySecret } from "../lib/providerSecrets.js";
import { parseCallableData } from "../lib/validation.js";
import { beginStripeOnboarding, stripeOnboardingCallbacks } from "../domain/stripeOnboarding.js";
import { stripeOnboardingDependencies } from "../services/stripeOnboarding.js";

type StripeAccountDocument = {
  payoutsEnabled?: boolean;
  stripeAccountId?: string;
};

export const createStripeAccount = onCall({ secrets: [stripeSecretKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    email: z.string().email(),
  });
  const data = parseCallableData(schema, request.data);
  const accountRef = firestore.collection("stripeAccounts").doc(uid);
  const existing = connectedAccountFromRecord((await accountRef.get()).data());
  if (existing) return existing;

  const account = await createConnectedAccount(
    { email: data.email, country: "BE", userId: uid },
    stripeSecretKeySecret.value(),
  );

  await accountRef.set(
    {
      userId: uid,
      stripeAccountId: account.id,
      accountVersion: "v1-express",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return account;
});

export const createStripeAccountLink = onCall({ secrets: [stripeSecretKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    returnUrl: z.literal(stripeOnboardingCallbacks.returnUrl),
    refreshUrl: z.literal(stripeOnboardingCallbacks.refreshUrl),
  });
  parseCallableData(schema, request.data);
  const accountSnap = await firestore.collection("stripeAccounts").doc(uid).get();
  const stripeAccount = accountSnap.data() as StripeAccountDocument | undefined;
  if (!stripeAccount?.stripeAccountId) {
    throw new HttpsError("failed-precondition", "Create a Stripe account before requesting onboarding.");
  }

  return beginStripeOnboarding(
    uid,
    stripeAccount.stripeAccountId,
    stripeOnboardingDependencies(stripeSecretKeySecret.value()),
  );
});

export const createRidePaymentIntent = onCall(
  { secrets: [stripeSecretKeySecret, stripePublishableKeySecret] },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    requireRole(request.auth?.token, "parent");
    const schema = z.object({
      bookingId: z.string(),
      currency: z.literal("eur").default("eur"),
    });
    const data = parseCallableData(schema, request.data);
    let publishableKey: string;
    try {
      publishableKey = stripePublishableKey(stripePublishableKeySecret.value());
    } catch (error) {
      throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Stripe PaymentSheet is not configured.");
    }

    const prepared = await prepareRidePayment(data.bookingId, uid);
    const paymentIntent = prepared.existingIntentId
      ? await createStripeClient(stripeSecretKeySecret.value()).paymentIntents.retrieve(prepared.existingIntentId)
      : await createRideDestinationPaymentIntent(prepared, stripeSecretKeySecret.value());
    await finishRidePayment(prepared, paymentIntent);

    return {
      bookingId: data.bookingId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      publishableKey,
      amountCents: prepared.amountCents,
      currency: data.currency,
    };
  },
);

export const issueRewardPayout = onCall({ secrets: [stripeSecretKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAdmin(request.auth?.token);
  const data = parseCallableData(rewardPayoutInput, request.data);
  const prepared = await reserveRewardPayout(data, uid);
  if (prepared.result) return prepared.result;
  const operation = prepared.operation!;
  let transfer;
  try {
    transfer = await createRewardPayoutTransfer(operation, stripeSecretKeySecret.value());
  } catch {
    throw new HttpsError("unavailable", "Payout is unconfirmed. Retry the same request; its balance remains reserved.");
  }
  await finishRewardPayout(transfer, operation);
  return payoutResult(operation, transfer.id);
});
