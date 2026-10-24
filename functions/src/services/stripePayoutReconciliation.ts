import type Stripe from "stripe";
import { HttpsError } from "firebase-functions/v2/https";
import { firestore } from "../lib/firebase.js";
import { stripeReport } from "./stripeWebhookReports.js";
import { finishRewardPayout } from "./rewardPayout.js";
import { recordPayoutReversal } from "./payoutReversals.js";
import { rewardPayoutInput, type PayoutTransfer } from "../domain/rewardPayout.js";

type StripeTransferUpdate = PayoutTransfer & {
  amount_reversed?: number;
  reversed?: boolean;
};

export function isTransferEvent(type: string): boolean {
  return type === "transfer.created" || type === "transfer.updated" || type === "transfer.reversed";
}

export async function reconcilePayoutTransfer(event: Stripe.Event, eventPath: string): Promise<void> {
  const transfer = event.data.object as StripeTransferUpdate;
  if (transfer.metadata?.product !== "sports-green-moove") {
    await firestore.doc(eventPath).set(stripeReport(event));
    return;
  }

  const userId = transfer.metadata.userId;
  const sourceId = transfer.metadata.sourceId;
  if (!transfer.id || transfer.id.includes("/") || !rewardPayoutInput.safeParse({ userId, sourceId,
      amountCents: transfer.amount, currency: transfer.currency }).success) {
    await firestore.doc(eventPath).set({ ...stripeReport(event), reconciliationStatus: "missingPayoutMetadata" });
    return;
  }

  const amountCents = transfer.amount!;
  const currency = transfer.currency!;
  const ledgerId = `payout_${userId}_${sourceId}`;
  const reversedAmountCents = transfer.amount_reversed;
  if (!Number.isSafeInteger(reversedAmountCents) || reversedAmountCents! < 0 || reversedAmountCents! > amountCents ||
      (transfer.reversed === true && reversedAmountCents !== amountCents)) {
    await firestore.doc(eventPath).set({ ...stripeReport(event), reconciliationStatus: "payoutReversalMismatch", ledgerId });
    return;
  }
  try {
    // A signed webhook can finish a reserved transfer even if the callable lost its response.
    await finishRewardPayout(transfer);
  } catch (error) {
    if (!(error instanceof HttpsError)) throw error;
    await firestore.doc(eventPath).set({ ...stripeReport(event), reconciliationStatus: "payoutOperationMismatch", ledgerId });
    return;
  }

  await firestore.runTransaction(async (transaction) => {
    const ledgerRef = firestore.collection("rewardLedger").doc(ledgerId);
    const ledgerSnap = await transaction.get(ledgerRef);
    if (!ledgerSnap.exists) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: "payoutLedgerMissing",
        ledgerId,
        transferId: transfer.id,
      });
      return;
    }

    const ledger = ledgerSnap.data() ?? {};
    if (
      ledger.userId !== userId ||
      ledger.type !== "payout" ||
      ledger.amountCents !== -amountCents ||
      ledger.currency !== currency ||
      ledger.sourceId !== transfer.id
    ) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: "payoutLedgerMismatch",
        ledgerId,
        transferId: transfer.id,
      });
      return;
    }

    const reversal = await recordPayoutReversal(transaction, event, { transferId: transfer.id!, userId: userId!, ledgerId,
      amountCents, reversedCents: reversedAmountCents!, currency });
    transaction.set(firestore.doc(eventPath), {
      ...stripeReport(event),
      ...reversal,
      ledgerId,
      transferId: transfer.id,
    });
  });
}
