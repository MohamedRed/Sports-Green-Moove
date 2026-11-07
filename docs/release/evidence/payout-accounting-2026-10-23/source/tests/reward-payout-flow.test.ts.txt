import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { issueRewardPayout as Callable } from "../functions/src/callables/payments.js";
import { createStripeWebhookFixtures, rewardPayoutTransfer, stripeEvent } from "./helpers/stripe-webhook-fixtures.js";

const transfer = vi.hoisted(() => vi.fn());
vi.mock("../functions/src/services/stripeConnect.js", async (original) => ({
  ...await original<typeof import("../functions/src/services/stripeConnect.js")>(),
  createRewardPayoutTransfer: transfer,
}));
vi.mock("../functions/src/lib/providerSecrets.js", async (original) => ({
  ...await original<typeof import("../functions/src/lib/providerSecrets.js")>(),
  stripeSecretKeySecret: { value: () => "synthetic-unused-secret" },
}));

let firestore: Firestore;
let payout: typeof Callable;
let reconcile: typeof import("../functions/src/services/stripeReconciliation.js").reconcileStripeEvent;
let clear: () => Promise<void>;
const collections = ["rewardLedger", "stripeAccounts", "rewardPayoutOperations", "rewardPayoutGuards", "reports", "payoutReversals"];
const input = (sourceId = "cycle-1", amountCents = 750) => ({ userId: "driver-1", sourceId, amountCents, currency: "eur" });
const invoke = (data = input()) => payout.run({ data, auth: { uid: "admin", token: { roleKeys: ["admin"] } } } as Parameters<typeof payout.run>[0]);

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Isolated Firestore emulator required.");
  process.env.GCLOUD_PROJECT = "sports-green-moove-rules-test";
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: process.env.GCLOUD_PROJECT,
    databaseURL: "https://sports-green-moove-rules-test.firebaseio.com" });
  ({ firestore } = await import("../functions/src/lib/firebase.js"));
  ({ issueRewardPayout: payout } = await import("../functions/src/callables/payments.js"));
  ({ reconcileStripeEvent: reconcile } = await import("../functions/src/services/stripeReconciliation.js"));
  clear = createStripeWebhookFixtures(firestore, collections).clearCollections;
});

beforeEach(async () => {
  await clear();
  transfer.mockReset();
  transfer.mockImplementation(async (context) => rewardPayoutTransfer({ amount: context.amountCents,
    id: `tr_${context.sourceId}`, destination: context.destinationStripeAccountId,
    metadata: { userId: context.userId, sourceId: context.sourceId, product: "sports-green-moove" } }));
  await firestore.doc("stripeAccounts/driver-1").set({ stripeAccountId: "acct_driver", payoutsEnabled: true });
  await firestore.doc("rewardLedger/credit").set({ id: "credit", userId: "driver-1", type: "co2Bonus", amountCents: 750,
    currency: "eur", sourceId: "synthetic-credit", createdAt: "2026-10-23T00:00:00.000Z" });
});
afterEach(async () => { await clear(); });

describe("isolated reward payout accounting", () => {
  it("does not send the same balance twice while the first transfer is still unresolved", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const implementation = transfer.getMockImplementation()!;
    transfer.mockImplementation(async (context) => { await gate; return implementation(context); });
    const first = invoke(input("first"));
    await vi.waitFor(() => expect(transfer).toHaveBeenCalledTimes(1), { timeout: 10_000 });
    let secondSettled = false;
    const second = invoke(input("second")).then((value) => ({ value }), (error) => ({ error }))
      .finally(() => { secondSettled = true; });
    try {
      await vi.waitFor(() => expect(secondSettled || transfer.mock.calls.length === 2).toBe(true), { timeout: 10_000 });
    } finally { release(); }
    const results = await Promise.allSettled([first, second]);
    expect(results[0].status).toBe("fulfilled");
    expect(await second).toMatchObject({ error: { code: "failed-precondition" } });
    expect(transfer).toHaveBeenCalledTimes(1);
    const ledger = (await firestore.collection("rewardLedger").get()).docs.map((doc) => doc.data());
    expect(ledger.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(0);
  }, 30_000);

  it("credits each cumulative partial reversal once without rewriting historical entries", async () => {
    await invoke();
    const event = (id: string, amount: number) => stripeEvent(id, "transfer.reversed", rewardPayoutTransfer({
      id: "tr_cycle-1", amount_reversed: amount, reversed: amount === 750, destination: "acct_driver" }));
    await reconcile(event("evt_partial", 250));
    const first = (await firestore.doc("rewardLedger/refund_tr_cycle-1_driver-1").get()).data();
    // Upgrade from the old single-refund writer: keep its immutable credit, without a new counter yet.
    await firestore.doc("payoutReversals/tr_cycle-1").delete();
    await reconcile(event("evt_full", 750));
    await reconcile(event("evt_stale", 250));
    await reconcile(event("evt_full_again", 750));
    expect((await firestore.doc("rewardLedger/refund_tr_cycle-1_driver-1").get()).data()).toEqual(first);
    const entries = (await firestore.collection("rewardLedger").where("type", "==", "refund").get()).docs.map((doc) => doc.data());
    expect(entries.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(750);
  });

  it("replays a completed request without another transfer or changing ledger bytes", async () => {
    const result = await invoke();
    const before = (await firestore.doc("rewardLedger/payout_driver-1_cycle-1").get()).data();
    await expect(invoke()).resolves.toEqual(result);
    expect(transfer).toHaveBeenCalledTimes(1);
    expect((await firestore.doc("rewardLedger/payout_driver-1_cycle-1").get()).data()).toEqual(before);
  });

  it("keeps an ambiguous provider failure reserved and recovers only the same frozen request", async () => {
    transfer.mockRejectedValueOnce(new Error("Synthetic lost response"));
    await expect(invoke()).rejects.toMatchObject({ code: "unavailable" });
    await expect(invoke(input("different"))).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(invoke(input("cycle-1", 700))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transfer).toHaveBeenCalledTimes(1);
    await expect(invoke()).resolves.toMatchObject({ transferId: "tr_cycle-1", amountCents: 750 });
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(transfer.mock.calls[0][0]).toEqual(transfer.mock.calls[1][0]);
    expect((await firestore.collection("rewardLedger").get()).size).toBe(2);
  });

  it("accepts a webhook before the provider response and posts only one immutable debit", async () => {
    const implementation = transfer.getMockImplementation()!;
    transfer.mockImplementation(async (context) => {
      const value = await implementation(context);
      await reconcile(stripeEvent("evt_early", "transfer.created", value));
      return value;
    });
    await expect(invoke()).resolves.toMatchObject({ transferId: "tr_cycle-1" });
    expect((await firestore.collection("rewardLedger").get()).size).toBe(2);
    expect((await firestore.doc("reports/stripe_evt_early").get()).get("reconciliationStatus")).toBe("payoutTransferReconciled");
  });

  it("does not resend an old unknown transfer after idempotency expiry but can reconcile its webhook", async () => {
    transfer.mockRejectedValueOnce(new Error("Synthetic unknown outcome"));
    await expect(invoke()).rejects.toMatchObject({ code: "unavailable" });
    const operation = (await firestore.collection("rewardPayoutOperations").get()).docs[0];
    await operation.ref.update({ createdAt: Timestamp.fromMillis(Date.now() - 24 * 3600_000) });
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transfer).toHaveBeenCalledTimes(1);
    await reconcile(stripeEvent("evt_old_confirmed", "transfer.created", rewardPayoutTransfer({ id: "tr_cycle-1", destination: "acct_driver" })));
    await expect(invoke()).resolves.toMatchObject({ transferId: "tr_cycle-1" });
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it.each([{ amount: 751 }, { currency: "usd" }, { destination: "acct_other" }, { id: "" },
    { metadata: { userId: "other", sourceId: "cycle-1", product: "sports-green-moove" } }])(
    "holds the balance when the provider response mismatches frozen terms: %j", async (overrides) => {
      transfer.mockResolvedValueOnce(rewardPayoutTransfer({ id: "tr_cycle-1", destination: "acct_driver", ...overrides }));
      await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
      expect((await firestore.collection("rewardLedger").get()).size).toBe(1);
      expect((await firestore.collection("rewardPayoutOperations").get()).docs[0].get("status")).toBe("reserved");
      await expect(invoke(input("another"))).rejects.toMatchObject({ code: "failed-precondition" });
      expect(transfer).toHaveBeenCalledTimes(1);
    });

  it("serializes two same-source calls with the same provider identity and a single debit", async () => {
    const results = await Promise.all([invoke(), invoke()]);
    expect(results[0]).toEqual(results[1]);
    expect((await firestore.collection("rewardLedger").where("type", "==", "payout").get()).size).toBe(1);
    expect(new Set(transfer.mock.calls.map(([context]) => JSON.stringify(context))).size).toBe(1);
  }, 30_000);

  it("keeps different users' reservations independent", async () => {
    transfer.mockRejectedValueOnce(new Error("Synthetic unresolved"));
    await expect(invoke()).rejects.toMatchObject({ code: "unavailable" });
    await firestore.doc("stripeAccounts/driver-2").set({ stripeAccountId: "acct_other", payoutsEnabled: true });
    await firestore.doc("rewardLedger/other-credit").set({ userId: "driver-2", amountCents: 750, currency: "eur" });
    await expect(invoke({ ...input(), userId: "driver-2" })).resolves.toMatchObject({ amountCents: 750 });
  });

  it("rejects missing request identity, unsafe money, and non-admin callers before contacting the provider", async () => {
    for (const data of [{ ...input(), sourceId: undefined }, { ...input(), amountCents: Number.MAX_SAFE_INTEGER + 1 },
      { ...input(), userId: "bad/path" }, { ...input(), currency: "usd" }])
      await expect(invoke(data as ReturnType<typeof input>)).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(payout.run({ data: input(), auth: { uid: "parent", token: { roleKeys: ["parent"] } } } as Parameters<typeof payout.run>[0]))
      .rejects.toMatchObject({ code: "permission-denied" });
    expect(transfer).not.toHaveBeenCalled();
    expect((await firestore.collection("rewardPayoutOperations").get()).empty).toBe(true);
  });

  it.each(["disabled-account", "insufficient", "corrupt-money"])("refuses %s before any transfer", async (kind) => {
    if (kind === "disabled-account") await firestore.doc("stripeAccounts/driver-1").update({ payoutsEnabled: false });
    else await firestore.doc("rewardLedger/credit").update({ amountCents: kind === "insufficient" ? 749 : 750.5 });
    await expect(invoke()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transfer).not.toHaveBeenCalled();
  });

  it("reuses a legacy posted payout without an operation and never transfers again", async () => {
    await firestore.doc("rewardLedger/payout_driver-1_cycle-1").set({ id: "payout_driver-1_cycle-1", userId: "driver-1", type: "payout",
      amountCents: -750, currency: "eur", sourceId: "tr_legacy", payoutSourceId: "cycle-1" });
    await expect(invoke()).resolves.toMatchObject({ transferId: "tr_legacy" });
    expect(transfer).not.toHaveBeenCalled();
  });

  it("blocks reuse when a completed operation's historical debit has disappeared", async () => {
    await invoke();
    await firestore.doc("rewardLedger/payout_driver-1_cycle-1").delete();
    await expect(invoke(input("another"))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent cumulative reversals and retains full credit after stale events", async () => {
    await invoke();
    const events = [250, 500, 750].map((amount) => stripeEvent(`evt_concurrent_${amount}`, "transfer.reversed",
      rewardPayoutTransfer({ id: "tr_cycle-1", destination: "acct_driver", amount_reversed: amount, reversed: amount === 750 })));
    await Promise.all(events.map(reconcile));
    await reconcile(stripeEvent("evt_stale_created", "transfer.created", rewardPayoutTransfer({ id: "tr_cycle-1", destination: "acct_driver" })));
    const entries = (await firestore.collection("rewardLedger").where("type", "==", "refund").get()).docs.map((doc) => doc.data());
    expect(entries.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(750);
    expect((await firestore.doc("payoutReversals/tr_cycle-1").get()).get("creditedCents")).toBe(750);
  }, 30_000);

  it.each([-1, 751, 0.5, undefined])("refuses an invalid cumulative reversal of %s", async (amount_reversed) => {
    await invoke();
    await reconcile(stripeEvent("evt_invalid", "transfer.reversed", rewardPayoutTransfer({ id: "tr_cycle-1",
      destination: "acct_driver", amount_reversed })));
    expect((await firestore.doc("reports/stripe_evt_invalid").get()).get("reconciliationStatus")).toBe("payoutReversalMismatch");
    expect((await firestore.collection("rewardLedger").where("type", "==", "refund").get()).empty).toBe(true);
  });

  it("reports a mismatched webhook without settling or releasing the reservation", async () => {
    transfer.mockRejectedValueOnce(new Error("Synthetic unknown outcome"));
    await expect(invoke()).rejects.toMatchObject({ code: "unavailable" });
    await reconcile(stripeEvent("evt_bad_destination", "transfer.created", rewardPayoutTransfer({ destination: "acct_other" })));
    expect((await firestore.doc("reports/stripe_evt_bad_destination").get()).get("reconciliationStatus")).toBe("payoutOperationMismatch");
    expect((await firestore.collection("rewardLedger").get()).size).toBe(1);
  });
});
