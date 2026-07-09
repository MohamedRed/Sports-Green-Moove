import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const PROJECT_ID = "sports-green-moove-rules-test";
const COLLECTIONS = ["bookings", "trips", "rewardLedger", "reports", "stripeAccounts"];

let firestore: Firestore;
let reconcileStripeEvent: (event: Stripe.Event) => Promise<void>;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required for Stripe webhook flow tests.");
  }
  process.env.GCLOUD_PROJECT ??= PROJECT_ID;
  process.env.FIREBASE_CONFIG ??= JSON.stringify({ projectId: PROJECT_ID });

  ({ firestore } = await import("../functions/src/lib/firebase.js"));
  ({ reconcileStripeEvent } = await import("../functions/src/services/stripeReconciliation.js"));
});

beforeEach(async () => {
  await clearCollections();
});

afterEach(async () => {
  await clearCollections();
});

describe("Stripe webhook reconciliation flow", () => {
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

async function seedRidePaymentContext(bookingOverrides: Record<string, unknown> = {}) {
  await firestore.collection("trips").doc("trip-1").set({
    priceCents: 250,
  });
  await firestore.collection("bookings").doc("booking-1").set({
    tripId: "trip-1",
    parentUserId: "parent-1",
    driverUserId: "driver-1",
    seats: 2,
    paymentIntentId: "pi_ride_1",
    ...bookingOverrides,
  });
}

function ridePaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: "pi_ride_1",
    object: "payment_intent",
    amount: 500,
    currency: "eur",
    metadata: {
      bookingId: "booking-1",
      tripId: "trip-1",
      payerUserId: "parent-1",
      driverUserId: "driver-1",
      platformFeeCents: "0",
      product: "sports-green-moove",
    },
    ...overrides,
  } as Stripe.PaymentIntent;
}

function rewardPayoutTransfer(overrides: Record<string, unknown> = {}): Stripe.Event.Data.Object {
  return {
    id: "tr_payout_1",
    object: "transfer",
    amount: 750,
    amount_reversed: 0,
    currency: "eur",
    metadata: {
      userId: "driver-1",
      sourceId: "cycle-1",
      product: "sports-green-moove",
    },
    reversed: false,
    ...overrides,
  } as Stripe.Event.Data.Object;
}

function stripeEvent(id: string, type: Stripe.Event.Type, object: Stripe.Event.Data.Object): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2026-05-20.preview",
    created: 1_765_000_000,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as Stripe.Event;
}

async function clearCollections() {
  for (const collection of COLLECTIONS) {
    await clearCollection(collection);
  }
}

async function clearCollection(collection: string) {
  while (true) {
    const snapshot = await firestore.collection(collection).limit(200).get();
    if (snapshot.empty) return;
    const batch = firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}
