import type Stripe from "stripe";
import type { RewardLedgerEntry } from "../domain/types.js";

export type LedgerDraft = Omit<RewardLedgerEntry, "id" | "createdAt"> & {
  bookingId: string;
  tripId: string;
};

export function buildRidePaymentLedgerEntries(intent: Stripe.PaymentIntent): LedgerDraft[] {
  const bookingId = intent.metadata.bookingId;
  const tripId = intent.metadata.tripId;
  const payerUserId = intent.metadata.payerUserId;
  const driverUserId = intent.metadata.driverUserId;
  const platformFeeCents = stripeMetadataAmount(intent.metadata.platformFeeCents);
  if (!bookingId || !tripId || !payerUserId || !driverUserId || intent.currency !== "eur" || platformFeeCents == null) {
    return [];
  }

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
      amountCents: intent.amount - platformFeeCents,
      currency: "eur",
      sourceId: intent.id,
      bookingId,
      tripId,
    },
  ];
}

function stripeMetadataAmount(value: string | undefined): number | undefined {
  if (value == null || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}
