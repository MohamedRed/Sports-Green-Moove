import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { createConnectedAccount, createStripeClient, platformFeeAmountCents } from "../services/stripeConnect.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

export const createStripeAccount = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    email: z.string().email(),
  });
  const data = schema.parse(request.data);
  const account = await createConnectedAccount({ email: data.email, country: "BE", userId: uid });

  await firestore.collection("stripeAccounts").doc(uid).set(
    {
      userId: uid,
      stripeAccountId: account.id,
      accountVersion: "v2",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return account;
});

export const createRidePaymentIntent = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    bookingId: z.string(),
    amountCents: z.number().int().positive(),
    currency: z.literal("eur").default("eur"),
    destinationStripeAccountId: z.string().optional(),
  });
  const data = schema.parse(request.data);
  const stripe = createStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: data.amountCents,
    currency: data.currency,
    automatic_payment_methods: { enabled: true },
    application_fee_amount: platformFeeAmountCents(data.amountCents),
    transfer_data: data.destinationStripeAccountId ? { destination: data.destinationStripeAccountId } : undefined,
    metadata: {
      bookingId: data.bookingId,
      payerUserId: uid,
      product: "sports-green-moove",
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
});
