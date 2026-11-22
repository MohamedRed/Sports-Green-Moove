import type Stripe from "stripe";
import { firestore } from "../lib/firebase.js";
import { stripeReport } from "./stripeWebhookReports.js";

type StripeTransferUpdate = {
  id?: string;
  amount?: number;
  amount_reversed?: number;
  currency?: string;
  metadata?: Record<string, string>;
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
  if (!transfer.id || !userId || !sourceId || transfer.amount == null || !transfer.currency) {
    await firestore.doc(eventPath).set({ ...stripeReport(event), reconciliationStatus: "missingPayoutMetadata" });
    return;
  }

  const amountCents = transfer.amount;
  const currency = transfer.currency.toLowerCase();
  const ledgerId = `payout_${userId}_${sourceId}`;
  const reversedAmountCents = payoutTransferReversedAmountCents(event.type, transfer);

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

    if (reversedAmountCents > 0) {
      const refundLedgerId = `refund_${transfer.id}_${userId}`;
      const refundRef = firestore.collection("rewardLedger").doc(refundLedgerId);
      const refundSnap = await transaction.get(refundRef);
      if (!refundSnap.exists) {
        transaction.set(refundRef, {
          id: refundLedgerId,
          userId,
          type: "refund",
          amountCents: reversedAmountCents,
          currency,
          sourceId: transfer.id,
          payoutLedgerId: ledgerId,
          createdAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });
      }
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: "payoutTransferReversed",
        ledgerId,
        refundLedgerId,
        transferId: transfer.id,
      });
      return;
    }

    transaction.set(firestore.doc(eventPath), {
      ...stripeReport(event),
      reconciliationStatus: "payoutTransferReconciled",
      ledgerId,
      transferId: transfer.id,
    });
  });
}

function payoutTransferReversedAmountCents(type: string, transfer: StripeTransferUpdate): number {
  if (type === "transfer.reversed" || transfer.reversed === true) {
    return Math.max(0, transfer.amount_reversed ?? transfer.amount ?? 0);
  }
  return Math.max(0, transfer.amount_reversed ?? 0);
}
