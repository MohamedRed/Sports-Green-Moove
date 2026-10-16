import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { changePaymentBalanceSchema, supplementAttemptSchema, type PreparedSupplement } from "../domain/tripChangePayments.js";
import { paymentReceiptSchema } from "../domain/paymentReceipts.js";
import { firestore } from "../lib/firebase.js";
import { platformFeeAmountCents } from "./stripeConnect.js";

export async function prepareTripChangePayment(balanceId: string, uid: string): Promise<PreparedSupplement> {
  const attemptId = randomUUID();
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection("tripChangeBalances").doc(balanceId), snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Trip change balance not found.");
    const balance = changePaymentBalanceSchema.parse(snapshot.data());
    if (balance.parentUserId !== uid) throw new HttpsError("permission-denied", "Only the booking parent can pay its supplement.");
    const bookingSnap = await transaction.get(firestore.collection("bookings").doc(balance.bookingId)), booking = bookingSnap.data();
    const tripSnap = await transaction.get(firestore.collection("trips").doc(balance.tripId)), trip = tripSnap.data();
    if (!booking || !trip || booking.tripId !== balance.tripId || booking.driverUserId !== balance.driverUserId ||
        (booking.parentUserId ?? booking.requesterUserId) !== uid || trip.driverUserId !== balance.driverUserId)
      throw new HttpsError("failed-precondition", "Supplement ownership must be reconciled.");
    if (balance.state !== "paymentDue" || balance.balanceCents <= 0 || balance.agreedAmountCents - balance.paidBeforeCents !== balance.balanceCents ||
        booking.status !== "approved" || booking.paymentStatus !== "paid" || booking.tripChangeBalanceId !== balanceId ||
        booking.tripChangeBalanceCents !== balance.balanceCents || booking.amountPaidCents !== balance.paidBeforeCents ||
        booking.agreedAmountCents !== balance.agreedAmountCents || !["published", "full"].includes(trip.status) ||
        trip.pendingChangeId || trip.activeRideSessionId)
      throw new HttpsError("failed-precondition", "A current approved unpaid supplement is required.");
    const invoices = await transaction.get(firestore.collection("ridePaymentReceipts").where("bookingId", "==", balance.bookingId).limit(101));
    if (invoices.size > 100) throw new HttpsError("resource-exhausted", "Booking payment history requires reconciliation.");
    const receipts = invoices.docs.map((doc) => paymentReceiptSchema.parse(doc.data()));
    if (!receipts.length || receipts.some((r) => r.tripId !== balance.tripId || r.payerUserId !== uid ||
        r.driverUserId !== balance.driverUserId || r.refundReservedCents !== 0) ||
        receipts.reduce((sum, r) => sum + r.amountCents - r.refundedCents, 0) !== booking.amountPaidCents)
      throw new HttpsError("failed-precondition", "Confirmed payment receipts are required before a supplement.");
    const account = await transaction.get(firestore.collection("stripeAccounts").doc(balance.driverUserId));
    const destination = account.data()?.stripeAccountId;
    if (typeof destination !== "string" || !destination) throw new HttpsError("failed-precondition", "Driver payment account is required.");
    const prior = balance.paymentAttempt?.status === "canceled" ? undefined : balance.paymentAttempt;
    if (prior && (prior.amountCents !== balance.balanceCents || prior.destinationStripeAccountId !== destination))
      throw new HttpsError("failed-precondition", "An existing supplement attempt requires reconciliation.");
    if (prior && !prior.intentId && Date.now() - prior.createdAt.toMillis() > 23 * 3600_000)
      throw new HttpsError("failed-precondition", "An old unknown supplement attempt requires provider reconciliation.");
    const attempt = prior ?? supplementAttemptSchema.parse({ id: attemptId, amountCents: balance.balanceCents,
      platformFeeCents: platformFeeAmountCents(balance.balanceCents), destinationStripeAccountId: destination,
      createdAt: Timestamp.now(), status: "creating" });
    if (!prior) transaction.update(ref, { paymentAttempt: attempt, updatedAt: Timestamp.now() });
    return { balanceId, attempt, bookingId: balance.bookingId, tripId: balance.tripId, payerUserId: uid,
      driverUserId: balance.driverUserId, amountCents: attempt.amountCents, currency: "eur", paymentAttemptId: attempt.id,
      platformFeeCents: attempt.platformFeeCents, destinationStripeAccountId: attempt.destinationStripeAccountId };
  });
}

export async function tripChangePaymentStatus(balanceId: string, uid: string) {
  const snapshot = await firestore.collection("tripChangeBalances").doc(balanceId).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Trip change balance not found.");
  const balance = changePaymentBalanceSchema.parse(snapshot.data());
  if (balance.parentUserId !== uid) throw new HttpsError("permission-denied", "Only the affected parent can review this payment.");
  return { balanceId, bookingId: balance.bookingId, state: balance.state, amountCents: balance.balanceCents,
    outstandingCents: balance.state === "settled" || balance.state === "cancelled" ? 0 : balance.balanceCents,
    currency: balance.currency, paymentStatus: balance.paymentAttempt?.status ?? null };
}
