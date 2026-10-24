import { paymentReceiptSchema } from "./paymentReceipts.js";

export type RidePaymentState = "pending" | "recorded" | "failed" | "canceled" | "review";
type RecordData = Record<string, unknown>;

/** This is application reconciliation, not a fresh request to the payment provider. */
export function recordedRidePaymentState(
  bookingId: string, paymentIntentId: string, booking: RecordData,
  receiptData: unknown, payerLedger: RecordData | undefined, driverLedger: RecordData | undefined,
): RidePaymentState {
  if (booking.paymentIntentId !== paymentIntentId) return "review";
  if (booking.paymentStatus !== "paid") {
    if (receiptData != null || payerLedger != null || driverLedger != null) return "review";
    if (booking.paymentStatus === "failed" || booking.paymentStatus === "canceled") return booking.paymentStatus;
    return ["processing", "requires_action", "requires_capture", "requires_confirmation", "requires_payment_method", "succeeded"]
      .includes(booking.paymentStatus as string) ? "pending" : "review";
  }
  const result = paymentReceiptSchema.safeParse(receiptData);
  if (!result.success) return "review";
  const receipt = result.data;
  const attempt = booking.paymentAttempt as RecordData | undefined;
  if (attempt != null && (attempt.currency !== "eur" || attempt.intentId !== paymentIntentId ||
      !Number.isSafeInteger(attempt.amountCents))) return "review";
  const amount = attempt?.amountCents ?? (
    Number.isSafeInteger(booking.paymentPriceCents) && Number.isSafeInteger(booking.seats)
      ? Number(booking.paymentPriceCents) * Number(booking.seats) : undefined
  );
  if (receipt.kind !== "original" || receipt.paymentIntentId !== paymentIntentId || receipt.bookingId !== bookingId ||
      receipt.tripId !== booking.tripId || receipt.payerUserId !== (booking.parentUserId ?? booking.requesterUserId) || receipt.driverUserId !== booking.driverUserId ||
      receipt.amountCents !== amount || !Number.isSafeInteger(booking.amountPaidCents) ||
      Number(booking.amountPaidCents) < receipt.amountCents || receipt.refundedCents !== 0 || receipt.refundReservedCents !== 0 ||
      booking.status === "cancelled" || ![undefined, "notRequired"].includes(booking.refundStatus as string | undefined)) return "review";
  const matches = (entry: RecordData | undefined, userId: string, type: string, amountCents: number) =>
    entry != null && Object.entries({ userId, type, amountCents, currency: "eur", sourceId: paymentIntentId,
      bookingId, tripId: receipt.tripId }).every(([key, value]) => entry[key] === value);
  return matches(payerLedger, receipt.payerUserId, "ridePayment", -receipt.amountCents) &&
    matches(driverLedger, receipt.driverUserId, "driverEarning", receipt.amountCents - receipt.platformFeeCents)
    ? "recorded" : "review";
}
