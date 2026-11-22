import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { firestore } from "../lib/firebase.js";
import { computeRewardBalanceCents } from "../domain/rewards.js";
import { payoutLedgerId, payoutMismatch, payoutOperationId, payoutResult, rewardPayoutOperation,
  samePayoutTerms, validPayoutLedger, validatePayoutTransfer,
  type PayoutTransfer, type RewardPayoutInput, type RewardPayoutOperation } from "../domain/rewardPayout.js";

function operationFrom(record: unknown): RewardPayoutOperation {
  const parsed = rewardPayoutOperation.safeParse(record);
  if (!parsed.success || parsed.data.id !== payoutOperationId(parsed.data)) payoutMismatch();
  return parsed.data;
}

export async function reserveRewardPayout(input: RewardPayoutInput, createdBy: string) {
  return firestore.runTransaction(async (transaction) => {
    const operationRef = firestore.collection("rewardPayoutOperations").doc(payoutOperationId(input));
    const guard = firestore.collection("rewardPayoutGuards").doc(input.userId);
    const ledgerRef = firestore.collection("rewardLedger").doc(payoutLedgerId(input));
    const [operationSnap, ledgerSnap] = await transaction.getAll(operationRef, ledgerRef);
    if (operationSnap.exists) {
      const operation = operationFrom(operationSnap.data());
      if (!samePayoutTerms(input, operation)) payoutMismatch();
      if (operation.status === "completed") {
        if (!ledgerSnap.exists || !validPayoutLedger(ledgerSnap.data()!, input, operation.transferId)) payoutMismatch();
        return { result: payoutResult(input, operation.transferId!) };
      }
      if (ledgerSnap.exists) payoutMismatch();
      // Stripe may prune idempotency keys after 24 hours. Never resend an old unknown outcome.
      if (Date.now() - operation.createdAt.toMillis() >= 23 * 3600_000) payoutMismatch();
      return { operation };
    }
    if (ledgerSnap.exists) {
      if (!validPayoutLedger(ledgerSnap.data()!, input)) payoutMismatch();
      return { result: payoutResult(input, ledgerSnap.get("sourceId")) };
    }
    await transaction.get(guard);
    const account = (await transaction.get(firestore.collection("stripeAccounts").doc(input.userId))).data();
    if (typeof account?.stripeAccountId !== "string" || !account.stripeAccountId || account.payoutsEnabled !== true)
      throw new HttpsError("failed-precondition", "An enabled payout account is required.");
    const ledger = await transaction.get(firestore.collection("rewardLedger").where("userId", "==", input.userId));
    const operations = await transaction.get(firestore.collection("rewardPayoutOperations").where("userId", "==", input.userId));
    const ledgerById = new Map(ledger.docs.map((entry) => [entry.id, entry.data()]));
    for (const entry of ledger.docs) {
      if (entry.get("currency") !== "eur" || !Number.isSafeInteger(entry.get("amountCents"))) payoutMismatch();
    }
    let balance: number;
    try {
      balance = computeRewardBalanceCents(ledger.docs.map(entry => ({ id: entry.id, ...entry.data() })) as
        Parameters<typeof computeRewardBalanceCents>[0], input.userId);
    } catch { payoutMismatch(); }
    for (const record of operations.docs) {
      const operation = operationFrom(record.data());
      if (record.id !== operation.id) payoutMismatch();
      const posted = ledgerById.get(payoutLedgerId(operation));
      if (operation.status === "reserved") {
        if (posted) payoutMismatch();
        balance -= operation.amountCents;
      } else if (!posted || !validPayoutLedger(posted, operation, operation.transferId)) payoutMismatch();
      if (!Number.isSafeInteger(balance)) payoutMismatch();
    }
    if (balance < input.amountCents) throw new HttpsError("failed-precondition", "Insufficient available reward balance.");
    const operation: RewardPayoutOperation = { ...input, id: operationRef.id, status: "reserved",
      destinationStripeAccountId: account.stripeAccountId, createdBy, createdAt: Timestamp.now() };
    transaction.create(operationRef, operation);
    // A shared document serializes distinct reservations, including an initially empty operation query.
    transaction.set(guard, { userId: input.userId, updatedAt: Timestamp.now() });
    return { operation };
  });
}

export async function finishRewardPayout(transfer: PayoutTransfer, expected?: RewardPayoutOperation): Promise<boolean> {
  if (expected) validatePayoutTransfer(expected, transfer);
  const userId = transfer.metadata?.userId, sourceId = transfer.metadata?.sourceId;
  if (!userId || userId.includes("/") || !sourceId) payoutMismatch();
  return firestore.runTransaction(async (transaction) => {
    const operationRef = firestore.collection("rewardPayoutOperations").doc(payoutOperationId({ userId, sourceId }));
    const snapshot = await transaction.get(operationRef);
    if (!snapshot.exists) { if (expected) payoutMismatch(); return false; }
    const operation = operationFrom(snapshot.data());
    if (expected && (!samePayoutTerms(expected, operation) ||
        expected.destinationStripeAccountId !== operation.destinationStripeAccountId)) payoutMismatch();
    validatePayoutTransfer(operation, transfer);
    const ledgerRef = firestore.collection("rewardLedger").doc(payoutLedgerId(operation));
    const guard = firestore.collection("rewardPayoutGuards").doc(userId);
    const ledger = await transaction.get(ledgerRef);
    await transaction.get(guard);
    if (ledger.exists && !validPayoutLedger(ledger.data()!, operation, transfer.id)) payoutMismatch();
    if (operation.status === "completed" && !ledger.exists) payoutMismatch();
    if (!ledger.exists) transaction.create(ledgerRef, { id: ledgerRef.id, userId, type: "payout",
      amountCents: -operation.amountCents, currency: operation.currency, sourceId: transfer.id,
      payoutSourceId: sourceId, createdBy: operation.createdBy, createdAt: new Date().toISOString() });
    if (operation.status !== "completed") {
      transaction.update(operationRef, { status: "completed", transferId: transfer.id });
      transaction.set(guard, { userId, updatedAt: Timestamp.now() });
    }
    return true;
  });
}
