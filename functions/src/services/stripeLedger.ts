import type Stripe from "stripe";
import type { RewardLedgerEntry } from "../domain/types.js";
import { platformFeeAmountCents } from "./stripeConnect.js";

export type LedgerDraft = Omit<RewardLedgerEntry, "id" | "createdAt"> & {
  bookingId: string;
  tripId: string;
};

export function buildRidePaymentLedgerEntries(intent: Stripe.PaymentIntent): LedgerDraft[] {
  const bookingId = intent.metadata.bookingId;
  const tripId = intent.metadata.tripId;
  const payerUserId = intent.metadata.payerUserId;
  const driverUserId = intent.metadata.driverUserId;
  if (!bookingId || !tripId || !payerUserId || !driverUserId || intent.currency !== "eur") return [];

  const feeCents = platformFeeAmountCents(intent.amount);
  return [
    {
      userId: payerUserId,
      type: "ridePayment",
      amountCents: -intent.amount,
      currency: "eur",
      sourceId: intent.id,
      bookingId,
      tripId,
    },
    {
      userId: driverUserId,
      type: "driverEarning",
      amountCents: intent.amount - feeCents,
      currency: "eur",
      sourceId: intent.id,
      bookingId,
      tripId,
    },
  ];
}
