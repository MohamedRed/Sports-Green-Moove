import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import type Stripe from "stripe";
import { firestore } from "../lib/firebase.js";
import { ridePaymentAmountCents, validateSucceededRidePaymentIntent } from "./stripePaymentValidation.js";
import type { RidePaymentIntentContext } from "./stripeConnect.js";

const attemptSchema = z.object({ id: z.uuid(), unitPriceCents: z.number().int().positive(), amountCents: z.number().int().positive(),
  currency: z.literal("eur"), status: z.enum(["creating", "created"]), intentId: z.string().min(1).optional(),
  destinationStripeAccountId: z.string().min(1), termsRevision: z.string().nullable(), createdAt: z.instanceof(Timestamp) }).strict();
export type PreparedRidePayment = RidePaymentIntentContext & { attemptId: string; existingIntentId?: string };

export async function prepareRidePayment(bookingId: string, uid: string): Promise<PreparedRidePayment> {
  const attemptId = randomUUID();
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection("bookings").doc(bookingId), snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snapshot.data()!;
    if ((booking.parentUserId ?? booking.requesterUserId) !== uid) throw new HttpsError("permission-denied", "Only the booking parent can pay.");
    if (booking.status !== "approved") throw new HttpsError("failed-precondition", "Booking must be approved before payment.");
    if (booking.paymentStatus === "paid") throw new HttpsError("failed-precondition", "Booking is already paid.");
    if (typeof booking.tripId !== "string" || typeof booking.driverUserId !== "string")
      throw new HttpsError("failed-precondition", "Booking ownership must be reconciled before payment.");
    const tripSnap = await transaction.get(firestore.collection("trips").doc(booking.tripId));
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = tripSnap.data()!;
    if (trip.driverUserId !== booking.driverUserId || !["published", "full"].includes(trip.status) || trip.activeRideSessionId || trip.pendingChangeId)
      throw new HttpsError("failed-precondition", "Resolve the trip state before starting payment.");
    const unitPriceCents = booking.agreedPriceCents ?? trip.priceCents;
    const amountCents = ridePaymentAmountCents({ id: bookingId, ...booking, paymentPriceCents: unitPriceCents }, { id: tripSnap.id, ...trip });
    if (amountCents == null) throw new HttpsError("failed-precondition", "This booking does not require payment.");
    const account = await transaction.get(firestore.collection("stripeAccounts").doc(booking.driverUserId));
    const destination = account.data()?.stripeAccountId;
    if (typeof destination !== "string" || !destination) throw new HttpsError("failed-precondition", "Driver Stripe account is required before paid rides.");
    const old = booking.paymentAttempt === undefined ? null : attemptSchema.safeParse(booking.paymentAttempt);
    if (old && !old.success) throw new HttpsError("failed-precondition", "Payment attempt must be reconciled.");
    const prior = old?.success ? old.data : null;
    if (prior && !prior.intentId && Date.now() - prior.createdAt.toMillis() > 23 * 3600_000)
      throw new HttpsError("failed-precondition", "An old unconfirmed payment attempt requires provider reconciliation before reuse.");
    const termsRevision = booking.tripTermsRevision ?? null;
    if (prior && (prior.amountCents !== amountCents || prior.unitPriceCents !== unitPriceCents ||
        prior.destinationStripeAccountId !== destination || prior.termsRevision !== termsRevision))
      throw new HttpsError("failed-precondition", "Payment terms changed during an existing attempt.");
    const legacyIntent = typeof booking.paymentIntentId === "string" && booking.paymentIntentId ? booking.paymentIntentId : undefined;
    if (!prior && legacyIntent && (booking.amountCents !== amountCents || booking.currency !== "eur"))
      throw new HttpsError("failed-precondition", "Existing payment amount must be reconciled before reuse.");
    const attempt = prior ?? { id: attemptId, unitPriceCents, amountCents, currency: "eur" as const, status: "creating" as const,
      destinationStripeAccountId: destination, termsRevision, createdAt: Timestamp.now(), ...(legacyIntent ? { intentId: legacyIntent } : {}) };
    if (!prior) transaction.update(ref, { paymentAttempt: attempt, paymentPriceCents: unitPriceCents,
      amountCents, currency: "eur", updatedAt: Timestamp.now() });
    return { bookingId, tripId: booking.tripId, payerUserId: uid, driverUserId: booking.driverUserId,
      amountCents, currency: "eur" as const, destinationStripeAccountId: destination,
      attemptId: attempt.id, existingIntentId: attempt.intentId, paymentAttemptId: attempt.id };
  });
}

export async function finishRidePayment(prepared: PreparedRidePayment, intent: Stripe.PaymentIntent) {
  const validation = validateSucceededRidePaymentIntent(intent, { id: prepared.bookingId, tripId: prepared.tripId,
    parentUserId: prepared.payerUserId, driverUserId: prepared.driverUserId, seats: 1,
    paymentPriceCents: prepared.amountCents, paymentIntentId: prepared.existingIntentId,
    paymentAttempt: { id: prepared.attemptId, intentId: prepared.existingIntentId } }, { id: prepared.tripId });
  if (!validation.ok || intent.transfer_data?.destination !== prepared.destinationStripeAccountId)
    throw new HttpsError("failed-precondition", "Payment provider returned mismatched booking terms.");
  const cancelled = intent.status === "canceled";
  const unavailable = await firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection("bookings").doc(prepared.bookingId), snapshot = await transaction.get(ref);
    const booking = snapshot.data();
    if (!booking || booking.paymentAttempt?.id !== prepared.attemptId || booking.driverUserId !== prepared.driverUserId ||
        (booking.parentUserId ?? booking.requesterUserId) !== prepared.payerUserId)
      throw new HttpsError("failed-precondition", "Payment attempt no longer belongs to this booking.");
    const attempt = attemptSchema.parse(booking.paymentAttempt), now = Timestamp.now();
    const history = firestore.collection("ridePaymentAttempts").doc(prepared.attemptId);
    transaction.set(history, { bookingId: prepared.bookingId, tripId: prepared.tripId, payerUserId: prepared.payerUserId,
      ...attempt, intentId: intent.id, status: intent.status, updatedAt: now });
    if (booking.paymentStatus === "paid") return booking.status !== "approved";
    if (booking.paymentStatus === "canceled" && !cancelled) return true;
    if (cancelled) {
      transaction.update(ref, { paymentStatus: "canceled", paymentAttempt: FieldValue.delete(), paymentIntentId: FieldValue.delete(), updatedAt: now });
      return true;
    }
    transaction.update(ref, { paymentAttempt: { ...attempt, status: "created", intentId: intent.id }, paymentIntentId: intent.id,
      paymentStatus: intent.status, stripeAccountId: prepared.destinationStripeAccountId, updatedAt: now });
    return booking.status !== "approved";
  });
  if (cancelled || unavailable) throw new HttpsError("failed-precondition", "Payment or booking closed during preparation. Refresh before starting another payment.");
}
