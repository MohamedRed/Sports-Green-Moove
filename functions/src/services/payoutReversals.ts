import type { Transaction } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { firestore } from "../lib/firebase.js";

export async function recordPayoutReversal(transaction: Transaction, event: Stripe.Event,
  payout: { transferId: string; userId: string; ledgerId: string; amountCents: number; reversedCents: number; currency: string }) {
  const { transferId, userId, ledgerId, amountCents, reversedCents, currency } = payout;
  const guard = firestore.collection("payoutReversals").doc(transferId);
  const previous = await transaction.get(guard);
  const entries = await transaction.get(firestore.collection("rewardLedger").where("sourceId", "==", transferId));
  const baseId = `refund_${transferId}_${userId}`;
  let credited = 0;
  for (const entry of entries.docs) {
    if (entry.get("type") !== "refund") continue;
    const value = entry.data();
    if (value.userId !== userId || value.payoutLedgerId !== ledgerId || value.currency !== currency ||
        value.id !== entry.id || (entry.id !== baseId && !entry.id.startsWith(`${baseId}_`)) ||
        !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0) return { reconciliationStatus: "payoutReversalMismatch" };
    credited += value.amountCents;
  }
  if (!Number.isSafeInteger(credited) || credited > amountCents || (previous.exists &&
      (previous.get("userId") !== userId || previous.get("payoutLedgerId") !== ledgerId ||
       previous.get("currency") !== currency || previous.get("amountCents") !== amountCents || previous.get("creditedCents") !== credited)))
    return { reconciliationStatus: "payoutReversalMismatch" };
  const refundLedgerId = credited === 0 ? baseId : `${baseId}_${reversedCents}`;
  if (reversedCents > credited) transaction.create(firestore.collection("rewardLedger").doc(refundLedgerId), {
    id: refundLedgerId, userId, type: "refund", amountCents: reversedCents - credited, currency,
    sourceId: transferId, payoutLedgerId: ledgerId,
    createdAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  });
  transaction.set(guard, { userId, payoutLedgerId: ledgerId, amountCents, currency, creditedCents: Math.max(credited, reversedCents) });
  return { reconciliationStatus: reversedCents > 0 ? "payoutTransferReversed" : "payoutTransferReconciled",
    ...(reversedCents > credited ? { refundLedgerId } : {}) };
}
