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
import { computeRewardBalanceCents } from "../domain/rewards.js";
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
  requireAuth(request.auth?.uid);
  requireAdmin(request.auth?.token);
  const schema = z.object({
    userId: z.string(),
    amountCents: z.number().int().positive(),
    currency: z.literal("eur").default("eur"),
    sourceId: z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/).optional(),
  });
  const data = parseCallableData(schema, request.data);
  const sourceId = data.sourceId ?? `manual_${Date.now()}`;
  const ledgerId = `payout_${data.userId}_${sourceId}`;
  const ledgerRef = firestore.collection("rewardLedger").doc(ledgerId);

  const accountSnap = await firestore.collection("stripeAccounts").doc(data.userId).get();
  const stripeAccount = accountSnap.data() as StripeAccountDocument | undefined;
  if (!stripeAccount?.stripeAccountId) {
    throw new HttpsError("failed-precondition", "User Stripe account is required before payout.");
  }
  if (stripeAccount.payoutsEnabled !== true) {
    throw new HttpsError("failed-precondition", "Stripe payouts are not enabled for this user.");
  }
  if ((await ledgerRef.get()).exists) {
    throw new HttpsError("already-exists", "This payout was already issued.");
  }

  const ledgerSnap = await firestore.collection("rewardLedger").where("userId", "==", data.userId).get();
  const balanceCents = computeRewardBalanceCents(
    ledgerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Parameters<typeof computeRewardBalanceCents>[0],
    data.userId,
  );
  if (balanceCents < data.amountCents) {
    throw new HttpsError("failed-precondition", "Insufficient reward balance.");
  }

  const transfer = await createRewardPayoutTransfer(
    {
      userId: data.userId,
      amountCents: data.amountCents,
      currency: data.currency,
      destinationStripeAccountId: stripeAccount.stripeAccountId,
      sourceId,
    },
    stripeSecretKeySecret.value(),
  );

  await ledgerRef.create({
    id: ledgerId,
    userId: data.userId,
    type: "payout",
    amountCents: -data.amountCents,
    currency: data.currency,
    sourceId: transfer.id,
    payoutSourceId: sourceId,
    createdAt: new Date().toISOString(),
    createdBy: request.auth?.uid,
  });

  return { transferId: transfer.id, ledgerId, amountCents: data.amountCents, currency: data.currency };
});
