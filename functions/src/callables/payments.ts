import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { createConnectedAccount, createRideDestinationPaymentIntent, stripePublishableKey } from "../services/stripeConnect.js";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";

type BookingDocument = {
  tripId: string;
  parentUserId?: string;
  requesterUserId?: string;
  driverUserId: string;
  seats?: number;
  status?: string;
  paymentStatus?: string;
};

type StripeAccountDocument = {
  stripeAccountId?: string;
};

export const createStripeAccount = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
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
  requireRole(request.auth?.token, "parent");
  const schema = z.object({
    bookingId: z.string(),
    currency: z.literal("eur").default("eur"),
  });
  const data = schema.parse(request.data);
  const bookingSnap = await firestore.collection("bookings").doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");

  const booking = bookingSnap.data() as BookingDocument;
  const parentUserId = booking.parentUserId ?? booking.requesterUserId;
  if (parentUserId !== uid) throw new HttpsError("permission-denied", "Only the booking parent can pay.");
  if (booking.status !== "approved") throw new HttpsError("failed-precondition", "Booking must be approved before payment.");
  if (booking.paymentStatus === "paid") throw new HttpsError("failed-precondition", "Booking is already paid.");

  const tripSnap = await firestore.collection("trips").doc(booking.tripId).get();
  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
  const trip = tripSnap.data() as Trip;
  const amountCents = trip.priceCents * (booking.seats ?? 1);
  if (amountCents <= 0) throw new HttpsError("failed-precondition", "This booking does not require payment.");

  const accountSnap = await firestore.collection("stripeAccounts").doc(booking.driverUserId).get();
  const stripeAccount = accountSnap.data() as StripeAccountDocument | undefined;
  if (!stripeAccount?.stripeAccountId) {
    throw new HttpsError("failed-precondition", "Driver Stripe account is required before paid rides.");
  }

  let publishableKey: string;
  try {
    publishableKey = stripePublishableKey();
  } catch (error) {
    throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Stripe PaymentSheet is not configured.");
  }

  const paymentIntent = await createRideDestinationPaymentIntent({
    bookingId: data.bookingId,
    tripId: booking.tripId,
    payerUserId: uid,
    driverUserId: booking.driverUserId,
    amountCents,
    currency: data.currency,
    destinationStripeAccountId: stripeAccount.stripeAccountId,
  });

  await bookingSnap.ref.set(
    {
      amountCents,
      currency: data.currency,
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
      stripeAccountId: stripeAccount.stripeAccountId,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return {
    bookingId: data.bookingId,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    publishableKey,
    amountCents,
    currency: data.currency,
  };
});
