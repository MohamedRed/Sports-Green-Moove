import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { changePaymentBalanceSchema, matchesSupplementIntent, supplementAttemptSchema } from "../domain/tripChangePayments.js";
import { paymentReceiptFor, paymentReceiptSchema, samePaymentReceipt } from "../domain/paymentReceipts.js";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { firestore } from "../lib/firebase.js";
import { buildRidePaymentLedgerEntries } from "./stripeLedger.js";
import { stripeReport } from "./stripeWebhookReports.js";

export async function reconcileTripChangePayment(intent: Stripe.PaymentIntent, event?: Stripe.Event) {
  const reportRef = event ? firestore.collection("reports").doc(`stripe_${event.id}`) : null;
  const balanceId = chatDocumentIdSchema.safeParse(intent.metadata.balanceId);
  if (!balanceId.success) {
    if (reportRef && event) await reportRef.set({ ...stripeReport(event), reconciliationStatus: "supplementMetadataInvalid" });
    return { status: "supplementMetadataInvalid", settled: false, closed: true };
  }
  return firestore.runTransaction(async (transaction) => {
    const ref = firestore.collection("tripChangeBalances").doc(balanceId.data), snapshot = await transaction.get(ref);
    const report = (status: string, settled = false, closed = true) => {
      if (reportRef && event) transaction.set(reportRef, { ...stripeReport(event), reconciliationStatus: status });
      return { status, settled, closed };
    };
    const parsed = changePaymentBalanceSchema.safeParse(snapshot.data());
    if (!parsed.success || !matchesSupplementIntent(intent, balanceId.data, parsed.data)) return report("supplementTermsMismatch");
    const balance = parsed.data, attempt = balance.paymentAttempt!;
    const nextAttempt = supplementAttemptSchema.safeParse({ ...attempt, intentId: intent.id, status: intent.status });
    if (!nextAttempt.success) return report("supplementStatusInvalid");
    const bookingRef = firestore.collection("bookings").doc(balance.bookingId), bookingSnap = await transaction.get(bookingRef);
    const booking = bookingSnap.data();
    if (!booking || booking.tripId !== balance.tripId || booking.driverUserId !== balance.driverUserId ||
        (booking.parentUserId ?? booking.requesterUserId) !== balance.parentUserId) return report("supplementBookingMismatch");
    const receiptRef = firestore.collection("ridePaymentReceipts").doc(intent.id), receiptSnap = await transaction.get(receiptRef);
    let receipt;
    try {
      receipt = paymentReceiptFor(intent, "tripChange", balanceId.data);
      if (receiptSnap.exists && !samePaymentReceipt(paymentReceiptSchema.parse(receiptSnap.data()), receipt))
        throw new Error("Supplement receipt identity changed.");
    } catch { return report("supplementReceiptMismatch"); }
    if (receiptSnap.exists) return report("supplementSettled", true, booking.status !== "approved");
    if (!["approved", "cancelled"].includes(booking.status) || !Number.isSafeInteger(booking.amountPaidCents) || booking.amountPaidCents < 0)
      return report("supplementBookingStateMismatch");
    const closed = booking.status === "cancelled";
    if (!closed && (balance.state !== "paymentDue" || booking.tripChangeBalanceId !== balanceId.data ||
        booking.tripChangeBalanceCents !== attempt.amountCents || booking.amountPaidCents !== balance.paidBeforeCents ||
        booking.agreedAmountCents !== balance.agreedAmountCents || balance.balanceCents !== attempt.amountCents ||
        balance.agreedAmountCents - balance.paidBeforeCents !== attempt.amountCents)) return report("supplementBookingStateMismatch");
    if (closed && balance.state !== "cancelled") return report("supplementBookingStateMismatch");
    // Only a confirmed succeeded intent changes money; incomplete replies retain the obligation.
    if (attempt.status === "canceled" && intent.status !== "canceled") return report("supplementTerminalAttemptUnchanged");
    const now = Timestamp.now();
    const ledger = intent.status === "succeeded" ? buildRidePaymentLedgerEntries(intent) : [];
    if (intent.status === "succeeded" && ledger.length !== 2) return report("supplementLedgerInvalid");
    transaction.set(firestore.collection("ridePaymentAttempts").doc(attempt.id), { ...nextAttempt.data,
      bookingId: balance.bookingId, tripId: balance.tripId, payerUserId: balance.parentUserId,
      driverUserId: balance.driverUserId, balanceId: balanceId.data, kind: "tripChange", updatedAt: now });
    transaction.update(ref, { paymentAttempt: nextAttempt.data, updatedAt: now });
    if (intent.status !== "succeeded") return report(intent.status === "canceled" ? "supplementCancelled" : "supplementPending", false, closed);
    transaction.create(receiptRef, receipt);
    transaction.update(bookingRef, { amountPaidCents: booking.amountPaidCents + intent.amount,
      ...(closed ? { refundStatus: "pending" } : { tripChangeBalanceCents: 0 }), updatedAt: now });
    if (!closed) transaction.update(ref, { state: "settled", settledAt: now, updatedAt: now });
    for (const entry of ledger) {
      const id = `${intent.id}_${entry.type}_${entry.userId}`;
      transaction.create(firestore.collection("rewardLedger").doc(id), { ...entry, id, createdAt: now.toDate().toISOString() });
    }
    return report("supplementSettled", true, closed);
  });
}
