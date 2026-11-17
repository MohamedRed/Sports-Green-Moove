import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

export const rewardPayoutInput = z.object({
  userId: z.string().min(1).max(128).refine((id) => !id.includes("/")),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("eur").default("eur"),
  sourceId: z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/),
});
export type RewardPayoutInput = z.output<typeof rewardPayoutInput>;
export const rewardPayoutOperation = rewardPayoutInput.extend({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  destinationStripeAccountId: z.string().min(1),
  status: z.enum(["reserved", "completed"]),
  createdAt: z.instanceof(Timestamp),
  createdBy: z.string().min(1),
  transferId: z.string().min(1).optional(),
}).refine((operation) => (operation.status === "completed") === Boolean(operation.transferId));
export type RewardPayoutOperation = z.output<typeof rewardPayoutOperation>;
export type PayoutTransfer = {
  id?: string; amount?: number; currency?: string;
  destination?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export function payoutOperationId(input: Pick<RewardPayoutInput, "userId" | "sourceId">): string {
  return createHash("sha256").update(JSON.stringify([input.userId, input.sourceId])).digest("hex");
}
export function payoutLedgerId(input: Pick<RewardPayoutInput, "userId" | "sourceId">): string {
  return `payout_${input.userId}_${input.sourceId}`;
}
export function payoutMismatch(): never {
  throw new HttpsError("failed-precondition", "Payout records require reconciliation before another transfer.");
}
export function samePayoutTerms(a: RewardPayoutInput, b: RewardPayoutInput): boolean {
  return a.userId === b.userId && a.sourceId === b.sourceId && a.amountCents === b.amountCents && a.currency === b.currency;
}
export function validatePayoutTransfer(operation: RewardPayoutOperation, transfer: PayoutTransfer): void {
  const destination = typeof transfer.destination === "string" ? transfer.destination : transfer.destination?.id;
  if (!transfer.id || transfer.id.includes("/") || transfer.amount !== operation.amountCents || transfer.currency !== operation.currency ||
      destination !== operation.destinationStripeAccountId || transfer.metadata?.userId !== operation.userId ||
      transfer.metadata.sourceId !== operation.sourceId || transfer.metadata.product !== "sports-green-moove" ||
      (operation.transferId && operation.transferId !== transfer.id)) payoutMismatch();
}
export function validPayoutLedger(record: Record<string, unknown>, input: RewardPayoutInput, transferId?: string): boolean {
  return record.id === payoutLedgerId(input) && record.userId === input.userId && record.type === "payout" &&
    record.amountCents === -input.amountCents && record.currency === input.currency && record.payoutSourceId === input.sourceId &&
    typeof record.sourceId === "string" && record.sourceId.length > 0 && (!transferId || record.sourceId === transferId);
}
export function payoutResult(input: RewardPayoutInput, transferId: string) {
  return { transferId, ledgerId: payoutLedgerId(input), amountCents: input.amountCents, currency: input.currency };
}
