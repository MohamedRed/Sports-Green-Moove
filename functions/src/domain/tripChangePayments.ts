import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { z } from "zod";
import { chatDocumentIdSchema as id } from "./chatReference.js";

const money = z.number().int().nonnegative().safe();
export const supplementAttemptSchema = z.object({ id: z.uuid(), amountCents: money.positive(), platformFeeCents: money,
  destinationStripeAccountId: id, createdAt: z.instanceof(Timestamp), intentId: id.optional(),
  status: z.enum(["creating", "requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "succeeded", "canceled"]),
}).strict().refine((a) => a.platformFeeCents <= a.amountCents);
export const changePaymentBalanceSchema = z.object({ bookingId: id, tripId: id, proposalId: id, parentUserId: id,
  driverUserId: id, currency: z.literal("eur"), paidBeforeCents: money, agreedAmountCents: money,
  balanceCents: z.number().int().safe(), state: z.enum(["paymentDue", "refundDue", "notRequired", "settled", "cancelled"]),
  paymentAttempt: supplementAttemptSchema.optional(),
}).passthrough();
export type SupplementAttempt = z.infer<typeof supplementAttemptSchema>;
export type ChangePaymentBalance = z.infer<typeof changePaymentBalanceSchema>;
export type PreparedSupplement = { balanceId: string; attempt: SupplementAttempt; bookingId: string; tripId: string;
  payerUserId: string; driverUserId: string; amountCents: number; currency: "eur"; paymentAttemptId: string;
  platformFeeCents: number; destinationStripeAccountId: string };

export function matchesSupplementIntent(intent: Stripe.PaymentIntent, balanceId: string,
  balance: Pick<ChangePaymentBalance, "bookingId" | "tripId" | "parentUserId" | "driverUserId" | "paymentAttempt">): boolean {
  const a = balance.paymentAttempt, m = intent.metadata, destination = intent.transfer_data?.destination;
  return Boolean(a && m.product === "sports-green-moove" && m.paymentPurpose === "tripChange" && m.balanceId === balanceId &&
    m.bookingId === balance.bookingId && m.tripId === balance.tripId && m.payerUserId === balance.parentUserId &&
    m.driverUserId === balance.driverUserId && m.paymentAttemptId === a.id &&
    (!a.intentId || a.intentId === intent.id) && intent.amount === a.amountCents && intent.currency === "eur" &&
    m.platformFeeCents === String(a.platformFeeCents) && (intent.application_fee_amount ?? 0) === a.platformFeeCents &&
    (typeof destination === "string" ? destination : destination?.id) === a.destinationStripeAccountId);
}
