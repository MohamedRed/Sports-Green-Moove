import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { z } from "zod";
import { chatDocumentIdSchema as id } from "./chatReference.js";

export const paymentReceiptSchema = z.object({
  paymentIntentId: id, bookingId: id, tripId: id, payerUserId: id, driverUserId: id,
  currency: z.literal("eur"), amountCents: z.number().int().positive().safe(),
  platformFeeCents: z.number().int().nonnegative().safe(), destinationStripeAccountId: id.optional(),
  kind: z.enum(["original", "tripChange"]), balanceId: id.optional(), createdAt: z.instanceof(Timestamp),
  refundedCents: z.number().int().nonnegative().safe(), refundReservedCents: z.number().int().nonnegative().safe(),
}).strict().refine((r) => r.platformFeeCents <= r.amountCents && r.refundedCents + r.refundReservedCents <= r.amountCents);
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;

export function paymentReceiptFor(intent: Stripe.PaymentIntent, kind: PaymentReceipt["kind"], balanceId?: string): PaymentReceipt {
  const destination = intent.transfer_data?.destination;
  if (!/^\d+$/.test(intent.metadata.platformFeeCents ?? "")) throw new Error("Invalid payment fee metadata.");
  return paymentReceiptSchema.parse({ paymentIntentId: intent.id, bookingId: intent.metadata.bookingId,
    tripId: intent.metadata.tripId, payerUserId: intent.metadata.payerUserId, driverUserId: intent.metadata.driverUserId,
    currency: intent.currency, amountCents: intent.amount, platformFeeCents: Number(intent.metadata.platformFeeCents),
    ...(destination ? { destinationStripeAccountId: typeof destination === "string" ? destination : destination.id } : {}),
    kind, ...(balanceId ? { balanceId } : {}), createdAt: Timestamp.now(), refundedCents: 0, refundReservedCents: 0 });
}

export function samePaymentReceipt(existing: PaymentReceipt, incoming: PaymentReceipt): boolean {
  const keys = ["paymentIntentId", "bookingId", "tripId", "payerUserId", "driverUserId", "currency", "amountCents",
    "platformFeeCents", "destinationStripeAccountId", "kind", "balanceId"] as const;
  return keys.every((key) => existing[key] === incoming[key]);
}
