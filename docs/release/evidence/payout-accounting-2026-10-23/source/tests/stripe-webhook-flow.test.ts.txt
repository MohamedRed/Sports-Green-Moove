import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createStripeWebhookFixtures, ridePaymentIntent, rewardPayoutTransfer, stripeEvent } from "./helpers/stripe-webhook-fixtures.js";
import { registerRidePaymentStatusChecks } from "./helpers/ride-payment-status-checks.js";

const PROJECT_ID = "sports-green-moove-rules-test";
const COLLECTIONS = ["bookings", "trips", "rewardLedger", "reports", "stripeAccounts", "tripCancellations", "notifications", "rideSessions",
  "ridePaymentReceipts", "ridePaymentAttempts", "tripChangeBalances", "rewardPayoutOperations", "rewardPayoutGuards", "payoutReversals"];

let firestore: Firestore;
let reconcileStripeEvent: (event: Stripe.Event) => Promise<void>;
let seedRidePaymentContext: ReturnType<typeof createStripeWebhookFixtures>["seedRidePaymentContext"];
let clearCollections: ReturnType<typeof createStripeWebhookFixtures>["clearCollections"];

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required for Stripe webhook flow tests.");
  }
  process.env.GCLOUD_PROJECT ??= PROJECT_ID;
  process.env.FIREBASE_CONFIG ??= JSON.stringify({ projectId: PROJECT_ID });

  ({ firestore } = await import("../functions/src/lib/firebase.js"));
  ({ reconcileStripeEvent } = await import("../functions/src/services/stripeReconciliation.js"));
  ({ seedRidePaymentContext, clearCollections } = createStripeWebhookFixtures(firestore, COLLECTIONS));
});

beforeEach(async () => {
  await clearCollections();
});

afterEach(async () => {
  await clearCollections();
});

registerRidePaymentStatusChecks(() => ({ firestore, seedRidePaymentContext, reconcileStripeEvent }));

describe("Stripe webhook reconciliation flow", () => {
  it("preserves immutable invoice and ledger bytes across later events and changed net paid money", async () => {
    await seedRidePaymentContext();
    const intent = ridePaymentIntent({ client_secret: "synthetic-not-for-storage" });
    await reconcileStripeEvent(stripeEvent("evt_receipt_first", "payment_intent.succeeded", intent));
    const ref = firestore.doc("ridePaymentReceipts/pi_ride_1"), receipt = (await ref.get()).data();
    const ledger = (await firestore.collection("rewardLedger").get()).docs.map((doc) => doc.data());
    expect(JSON.stringify(receipt)).not.toContain("synthetic-not-for-storage");
    await firestore.doc("bookings/booking-1").update({ amountPaidCents: 650 });
    await reconcileStripeEvent({ ...stripeEvent("evt_receipt_later", "payment_intent.succeeded", intent), created: 1_765_003_600 });
    expect((await ref.get()).data()).toEqual(receipt);
    expect((await firestore.collection("rewardLedger").get()).docs.map((doc) => doc.data())).toEqual(ledger);
    expect((await firestore.doc("bookings/booking-1").get()).get("amountPaidCents")).toBe(650);
  });

  it.each(["receipt", "ledger"])("reports corrupted %s without overwriting historical money", async (kind) => {
    await seedRidePaymentContext();
    const intent = ridePaymentIntent();
    await reconcileStripeEvent(stripeEvent("evt_receipt_valid", "payment_intent.succeeded", intent));
    const path = kind === "receipt" ? "ridePaymentReceipts/pi_ride_1" : "rewardLedger/pi_ride_1_driverEarning_driver-1";
    await firestore.doc(path).update({ amountCents: 501 });
    const before = (await firestore.doc("bookings/booking-1").get()).data();
    await reconcileStripeEvent(stripeEvent("evt_receipt_corrupt", "payment_intent.succeeded", intent));
    expect((await firestore.doc("reports/stripe_evt_receipt_corrupt").get()).get("reconciliationStatus"))
      .toBe(kind === "receipt" ? "paymentReceiptMismatch" : "paymentLedgerMismatch");
    expect((await firestore.doc(path).get()).get("amountCents")).toBe(501);
    expect((await firestore.doc("bookings/booking-1").get()).data()).toEqual(before);
  });
  // Real emulator transaction contention can outlast the five-second unit default.
  // Both operations must settle before afterEach removes their shared fixture.
  it.each(["payment-first", "cancellation-first", "concurrent"])("preserves a closed booking and pending refund across %s", async (order) => {
    await seedRidePaymentContext({ status: "approved" });
    await firestore.doc("trips/trip-1").update({ driverUserId: "driver-1", status: "published", seatsTotal: 4, seatsAvailable: 2 });
    const { previewTripCancellation, cancelPublishedTrip } = await import("../functions/src/services/tripCancellation.js");
    const preview = await previewTripCancellation("trip-1", "driver-1", false);
    const input = { tripId: "trip-1", expectedRevision: preview.revision!, requestId: randomUUID(), reason: "Local cancellation" };
    const payment = () => reconcileStripeEvent(stripeEvent("evt_cancellation_race", "payment_intent.succeeded", ridePaymentIntent()));
    const cancel = () => cancelPublishedTrip(input, "driver-1", false);
    if (order === "payment-first") { await payment(); input.expectedRevision = (await previewTripCancellation("trip-1", "driver-1", false)).revision!; await cancel(); }
    else if (order === "cancellation-first") { await cancel(); await payment(); }
    else {
      const results = await Promise.allSettled([payment(), cancel()]);
      for (const result of results) if (result.status === "rejected") expect(result.reason.code).toBe("aborted");
      if ((await firestore.doc("trips/trip-1").get()).get("status") !== "cancelled") {
        input.expectedRevision = (await previewTripCancellation("trip-1", "driver-1", false)).revision!; await cancel();
      }
    }
    expect((await firestore.doc("bookings/booking-1").get()).data()).toMatchObject({ status: "cancelled", paymentStatus: "paid", refundStatus: "pending" });
    expect((await firestore.doc("trips/trip-1").get()).data()).toMatchObject({ status: "cancelled", seatsAvailable: 4 });
    expect((await firestore.collection("rewardLedger").get()).size).toBe(2);
    expect((await firestore.collection("notifications").get()).size).toBe(1);
  }, 30_000);

  it.each([undefined, "notRequired", "pending"])("keeps a cancelled booking closed and flags a late payment for refund: %s", async (refundStatus) => {
    await seedRidePaymentContext({ status: "cancelled", ...(refundStatus ? { refundStatus } : {}) });
    const event = stripeEvent("evt_late_payment", "payment_intent.succeeded", ridePaymentIntent());
    await reconcileStripeEvent(event);
    await reconcileStripeEvent(event);
    expect((await firestore.doc("bookings/booking-1").get()).data()).toMatchObject({
      status: "cancelled", paymentStatus: "paid", refundStatus: "pending", amountPaidCents: 500,
    });
    expect((await firestore.collection("rewardLedger").get()).size).toBe(2);
  });

  it("does not reopen a settled refund from a different success event for the same payment", async () => {
    await seedRidePaymentContext({ status: "cancelled", paymentStatus: "paid", refundStatus: "refunded" });
    await reconcileStripeEvent(stripeEvent("evt_paid_again", "payment_intent.succeeded", ridePaymentIntent()));
    expect((await firestore.doc("bookings/booking-1").get()).data()).toMatchObject({ status: "cancelled", refundStatus: "refunded" });
  });

  it("marks a validated ride payment as paid, writes ledger entries, and is idempotent", async () => {
    await seedRidePaymentContext();

    const event = stripeEvent(
      "evt_payment_succeeded",
      "payment_intent.succeeded",
      ridePaymentIntent({ id: "pi_ride_1" }),
    );

    await reconcileStripeEvent(event);
    await reconcileStripeEvent(event);

    const booking = await firestore.collection("bookings").doc("booking-1").get();
    expect(booking.data()).toMatchObject({
      paymentStatus: "paid",
      amountPaidCents: 500,
      paymentIntentId: "pi_ride_1",
    });

    const ledger = await firestore.collection("rewardLedger").get();
    expect(ledger.size).toBe(2);
    expect(ledger.docs.map((doc) => doc.data())).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "pi_ride_1_ridePayment_parent-1", type: "ridePayment", userId: "parent-1", amountCents: -500 }),
      expect.objectContaining({ id: "pi_ride_1_driverEarning_driver-1", type: "driverEarning", userId: "driver-1", amountCents: 500 }),
    ]));

    const report = await firestore.collection("reports").doc("stripe_evt_payment_succeeded").get();
    expect(report.data()).toMatchObject({
      type: "stripeWebhook",
      eventId: "evt_payment_succeeded",
      reconciliationStatus: "paymentReconciled",
    });
  });

  it("does not downgrade a paid booking from a later failed PaymentIntent webhook", async () => {
    await seedRidePaymentContext({
      paymentStatus: "paid",
      paymentIntentId: "pi_ride_1",
    });

    await reconcileStripeEvent(stripeEvent(
      "evt_payment_failed",
      "payment_intent.payment_failed",
      ridePaymentIntent({ id: "pi_ride_1" }),
    ));

    const booking = await firestore.collection("bookings").doc("booking-1").get();
    expect(booking.data()).toMatchObject({
      paymentStatus: "paid",
      paymentIntentId: "pi_ride_1",
    });

    const report = await firestore.collection("reports").doc("stripe_evt_payment_failed").get();
    expect(report.data()).toMatchObject({
      reconciliationStatus: "paidBookingUnchanged",
    });
  });

  it("updates connected account readiness from account.updated webhooks", async () => {
    await firestore.collection("stripeAccounts").doc("driver-1").set({
      userId: "driver-1",
      stripeAccountId: "acct_driver",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });

    await reconcileStripeEvent(stripeEvent("evt_account_updated", "account.updated", {
      id: "acct_driver",
      object: "account",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    }));

    const account = await firestore.collection("stripeAccounts").doc("driver-1").get();
    expect(account.data()).toMatchObject({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });

    const report = await firestore.collection("reports").doc("stripe_evt_account_updated").get();
    expect(report.data()).toMatchObject({ reconciliationStatus: "accountUpdated" });
  });

  it("reconciles reward payout transfer webhooks and records reversals as refund ledger entries", async () => {
    await firestore.collection("rewardLedger").doc("payout_driver-1_cycle-1").set({
      id: "payout_driver-1_cycle-1",
      userId: "driver-1",
      type: "payout",
      amountCents: -750,
      currency: "eur",
      sourceId: "tr_payout_1",
      payoutSourceId: "cycle-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const created = stripeEvent("evt_transfer_created", "transfer.created", rewardPayoutTransfer());
    await reconcileStripeEvent(created);
    await reconcileStripeEvent(created);

    const createdReport = await firestore.collection("reports").doc("stripe_evt_transfer_created").get();
    expect(createdReport.data()).toMatchObject({
      reconciliationStatus: "payoutTransferReconciled",
      ledgerId: "payout_driver-1_cycle-1",
      transferId: "tr_payout_1",
    });

    const reversed = stripeEvent("evt_transfer_reversed", "transfer.reversed", rewardPayoutTransfer({
      amount_reversed: 750,
      reversed: true,
    }));
    await reconcileStripeEvent(reversed);
    await reconcileStripeEvent(reversed);

    const refund = await firestore.collection("rewardLedger").doc("refund_tr_payout_1_driver-1").get();
    expect(refund.data()).toMatchObject({
      id: "refund_tr_payout_1_driver-1",
      userId: "driver-1",
      type: "refund",
      amountCents: 750,
      currency: "eur",
      sourceId: "tr_payout_1",
      payoutLedgerId: "payout_driver-1_cycle-1",
    });

    const ledger = await firestore.collection("rewardLedger").get();
    expect(ledger.size).toBe(2);

    const reversedReport = await firestore.collection("reports").doc("stripe_evt_transfer_reversed").get();
    expect(reversedReport.data()).toMatchObject({
      reconciliationStatus: "payoutTransferReversed",
      ledgerId: "payout_driver-1_cycle-1",
      refundLedgerId: "refund_tr_payout_1_driver-1",
      transferId: "tr_payout_1",
    });
  });
});
