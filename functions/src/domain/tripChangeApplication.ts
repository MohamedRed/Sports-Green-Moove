import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { tripChangeReferenceSchema, tripChangeHash } from "./tripChanges.js";
import { chatDocumentIdSchema as documentId } from "./chatReference.js";

export const routeQuoteSchema = z.object({ distanceMeters: z.number().int().positive().max(10_000_000),
  durationSeconds: z.number().int().positive().max(30 * 86400), encodedPolyline: z.string().min(1).max(100_000).optional() }).strict();
export type TripRouteQuote = z.infer<typeof routeQuoteSchema>;
export const quoteTripChangeSchema = tripChangeReferenceSchema.extend({ requestId: z.uuid(),
  proposalRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const applyTripChangeSchema = quoteTripChangeSchema.extend({ quoteId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const applicationReceiptSchema = z.object({ tripId: documentId, proposalId: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.uuid(), proposalRevision: z.string().regex(/^[a-f0-9]{64}$/), quoteId: z.string().regex(/^[a-f0-9]{64}$/),
  actorUserId: documentId, appliedAt: z.instanceof(Timestamp), bookingIds: z.array(documentId).max(100),
  settlementRequiredCount: z.number().int().min(0).max(100) }).strict();

export function tripChangeBookingPrice(booking: Record<string, unknown>, oldPrice: number, newPrice: number) {
  if (![oldPrice, newPrice].every((price) => Number.isSafeInteger(price) && price >= 0 && price <= 100_000))
    throw new Error("Invalid price terms.");
  const seats = booking.seats;
  if (!Number.isSafeInteger(seats) || Number(seats) < 1 || Number(seats) > 8) throw new Error("Invalid booking seats.");
  const totalCents = newPrice * Number(seats), paid = booking.paymentStatus === "paid";
  if (!paid && (booking.paymentAttempt || booking.paymentIntentId) && booking.paymentStatus !== "canceled")
    throw new Error("An existing payment must be completed or reconciled before applying changes.");
  if (paid && (!Number.isSafeInteger(booking.amountPaidCents) || booking.amountPaidCents !== oldPrice * Number(seats) ||
      (booking.currency !== undefined && booking.currency !== "eur")))
    throw new Error("Recorded paid amount does not match the original agreed terms.");
  if (booking.tripChangeBalanceCents !== undefined && booking.tripChangeBalanceCents !== 0)
    throw new Error("A previous trip-change balance must be reconciled first.");
  if (paid && booking.paymentPriceCents !== undefined && (!Number.isSafeInteger(booking.paymentPriceCents) ||
      Number(booking.paymentPriceCents) <= 0 || Number(booking.paymentPriceCents) > 100_000)) throw new Error("Invalid original payment invoice.");
  const paidBeforeCents = paid ? Number(booking.amountPaidCents) : 0;
  const balanceCents = paid ? totalCents - paidBeforeCents : 0;
  return { agreedPriceCents: newPrice, agreedAmountCents: totalCents, paidBeforeCents, balanceCents,
    paymentPriceCents: paid ? booking.paymentPriceCents ?? oldPrice : null,
    state: balanceCents > 0 ? "paymentDue" as const : balanceCents < 0 ? "refundDue" as const : "notRequired" as const };
}

export function applicationBalanceId(proposalId: string, bookingId: string) { return tripChangeHash([proposalId, bookingId]); }
