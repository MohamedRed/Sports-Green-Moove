import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { createStripeWebhookFixtures, stripeEvent } from "./helpers/stripe-webhook-fixtures.js";
import type { createRidePaymentIntent as Callable } from "../functions/src/callables/payments.js";

const provider = vi.hoisted(() => ({create: vi.fn(), retrieve: vi.fn()}));
vi.mock("../functions/src/services/stripeConnect.js", async original => ({
  ...await original<typeof import("../functions/src/services/stripeConnect.js")>(),
  createRideDestinationPaymentIntent: provider.create,
  createStripeClient: () => ({paymentIntents: {retrieve: provider.retrieve}}),
}));
vi.mock("../functions/src/lib/providerSecrets.js", async original => ({
  ...await original<typeof import("../functions/src/lib/providerSecrets.js")>(),
  stripeSecretKeySecret: {value: () => "synthetic-unused-secret"},
  stripePublishableKeySecret: {value: () => "pk_test_isolated_not_a_real_key"},
}));

let firestore: Firestore, pay: typeof Callable, clear: () => Promise<void>;
let build: typeof import("../functions/src/services/stripeConnect.js").buildRidePaymentIntentCreateParams;
let reconcile: typeof import("../functions/src/services/stripeReconciliation.js").reconcileStripeEvent;
const originalRate = process.env.PLATFORM_FEE_BPS;
const invoke = (uid = "parent-1") => pay.run({data: {bookingId: "booking-1"},
  auth: {uid, token: {roleKeys: ["parent"]}}} as Parameters<typeof pay.run>[0]);
const intents = new Map<string, {params: Stripe.PaymentIntentCreateParams; intent: Stripe.PaymentIntent}>();

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(127\.0\.0\.1|localhost):\d+$/)) throw new Error("Loopback Firestore emulator required");
  process.env.GCLOUD_PROJECT = "sports-green-moove-rules-test";
  process.env.FIREBASE_CONFIG = JSON.stringify({projectId: process.env.GCLOUD_PROJECT,
    databaseURL: "https://sports-green-moove-rules-test.firebaseio.com"});
  ({firestore} = await import("../functions/src/lib/firebase.js"));
  ({createRidePaymentIntent: pay} = await import("../functions/src/callables/payments.js"));
  ({buildRidePaymentIntentCreateParams: build} = await import("../functions/src/services/stripeConnect.js"));
  ({reconcileStripeEvent: reconcile} = await import("../functions/src/services/stripeReconciliation.js"));
  clear = createStripeWebhookFixtures(firestore, ["trips", "bookings", "stripeAccounts", "ridePaymentAttempts", "reports", "rewardLedger", "ridePaymentReceipts"]).clearCollections;
});
beforeEach(async () => {
  await clear(); process.env.PLATFORM_FEE_BPS = "1000"; intents.clear(); provider.create.mockReset(); provider.retrieve.mockReset();
  await firestore.doc("trips/trip-1").set({priceCents: 500, driverUserId: "driver-1", status: "published"});
  await firestore.doc("bookings/booking-1").set({tripId: "trip-1", parentUserId: "parent-1", driverUserId: "driver-1", seats: 2, status: "approved"});
  await firestore.doc("stripeAccounts/driver-1").set({stripeAccountId: "acct_driver"});
  provider.create.mockImplementation(async context => {
    const request = build(context), prior = intents.get(request.idempotencyKey);
    if (prior) { expect(request.params).toEqual(prior.params); return prior.intent; }
    const intent = {id: "pi_isolated", object: "payment_intent", ...request.params, status: "requires_payment_method",
      client_secret: "synthetic-client-secret"} as Stripe.PaymentIntent;
    intents.set(request.idempotencyKey, {params: request.params, intent}); return intent;
  });
  provider.retrieve.mockImplementation(async id => {
    const saved = [...intents.values()].find(row => row.intent.id === id);
    if (!saved) throw new Error("Unknown isolated provider identity"); return saved.intent;
  });
});
afterEach(async () => {
  await clear(); if (originalRate === undefined) delete process.env.PLATFORM_FEE_BPS; else process.env.PLATFORM_FEE_BPS = originalRate;
});

describe("isolated initial ride payment preparation", () => {
  it("freezes the fee before contacting the provider and reuses it after a lost response and configuration change", async () => {
    const create = provider.create.getMockImplementation()!;
    provider.create.mockImplementationOnce(async context => {await create(context); throw new Error("Synthetic response lost");});
    await expect(invoke()).rejects.toThrow("Synthetic response lost");
    const original = (await firestore.doc("bookings/booking-1").get()).data()!;
    expect(original.paymentAttempt.platformFeeCents).toBe(100);
    process.env.PLATFORM_FEE_BPS = "2500";
    await expect(invoke()).resolves.toMatchObject({paymentIntentId: "pi_isolated", amountCents: 1000});
    expect(intents.size).toBe(1);
    expect(provider.create.mock.calls[0][0].platformFeeCents).toBe(provider.create.mock.calls[1][0].platformFeeCents);
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentAttempt.platformFeeCents")).toBe(100);
  });
  it("rejects a provider fee different from the frozen attempt without exposing a payment configuration", async () => {
    const create = provider.create.getMockImplementation()!;
    provider.create.mockImplementation(async context => {
      const intent = await create(context); return {...intent, application_fee_amount: 250,
        metadata: {...intent.metadata, platformFeeCents: "250"}};
    });
    await expect(invoke()).rejects.toMatchObject({code: "failed-precondition"});
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentIntentId")).toBeUndefined();
    expect((await firestore.collection("ridePaymentAttempts").get()).empty).toBe(true);
  });
  it("serializes concurrent calls onto one invoice and the same provider identity", async () => {
    const create = provider.create.getMockImplementation()!;
    let release!: () => void; const gate = new Promise<void>(resolve => {release = resolve;});
    provider.create.mockImplementationOnce(async context => {const result = await create(context); await gate; return result;});
    const first = invoke();
    await vi.waitFor(() => expect(intents.size).toBe(1), {timeout: 10_000});
    process.env.PLATFORM_FEE_BPS = "2500";
    try { await expect(invoke()).resolves.toMatchObject({paymentIntentId: "pi_isolated"}); }
    finally { release(); }
    await expect(first).resolves.toMatchObject({paymentIntentId: "pi_isolated"});
    expect(intents.size).toBe(1); expect(provider.create).toHaveBeenCalledTimes(2);
    expect((await firestore.collection("ridePaymentAttempts").get()).size).toBe(1);
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentAttempt.platformFeeCents")).toBe(100);
  }, 30_000);
  it("retrieves a confirmed provider identity without applying a newer invalid fee configuration", async () => {
    await invoke(); process.env.PLATFORM_FEE_BPS = "invalid-new-configuration";
    await expect(invoke()).resolves.toMatchObject({paymentIntentId: "pi_isolated"});
    expect(provider.create).toHaveBeenCalledTimes(1); expect(provider.retrieve).toHaveBeenCalledTimes(1);
  });
  it.each(["-10", "", "10001", "1.5", "not-a-rate"])("rejects invalid rate %j before creating an attempt or contacting the provider", async rate => {
    process.env.PLATFORM_FEE_BPS = rate;
    await expect(invoke()).rejects.toBeDefined();
    expect(provider.create).not.toHaveBeenCalled();
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentAttempt")).toBeUndefined();
  });
  it.each(["booking", "booking-with-attempt", "attempt", "both"])("reconciles a known legacy intent from its actual fee and %s identity", async kind => {
    await firestore.doc("bookings/booking-1").update({...(kind === "attempt" ? {} : {paymentIntentId: "pi_legacy"}), amountCents: 1000, currency: "eur"});
    if (kind !== "booking") await firestore.doc("bookings/booking-1").update({paymentAttempt: {
      id: "11111111-1111-4111-8111-111111111111", amountCents: 1000, unitPriceCents: 500, currency: "eur", status: "created",
      destinationStripeAccountId: "acct_driver", termsRevision: null, createdAt: Timestamp.now(), ...(["attempt", "both"].includes(kind) ? {intentId: "pi_legacy"} : {})}});
    provider.retrieve.mockResolvedValue({id: "pi_legacy", amount: 1000, currency: "eur", application_fee_amount: 50,
      transfer_data: {destination: "acct_driver"}, metadata: {bookingId: "booking-1", tripId: "trip-1", payerUserId: "parent-1",
        driverUserId: "driver-1", product: "sports-green-moove", platformFeeCents: "50"}, status: "requires_payment_method"});
    await expect(invoke()).resolves.toMatchObject({paymentIntentId: "pi_legacy"});
    expect(provider.create).not.toHaveBeenCalled();
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentAttempt.platformFeeCents")).toBe(50);
  });
  it("rejects conflicting persisted provider identities before retrieving or creating anything", async () => {
    await invoke();
    await firestore.doc("bookings/booking-1").update({paymentIntentId: "pi_other"});
    await expect(invoke()).rejects.toMatchObject({code: "failed-precondition"});
    expect(provider.create).toHaveBeenCalledTimes(1); expect(provider.retrieve).not.toHaveBeenCalled();
  });
  it("does not invent fees for an old unknown legacy attempt with no provider identity", async () => {
    await firestore.doc("bookings/booking-1").update({paymentAttempt: {id: "11111111-1111-4111-8111-111111111111",
      amountCents: 1000, unitPriceCents: 500, currency: "eur", status: "creating", destinationStripeAccountId: "acct_driver",
      termsRevision: null, createdAt: Timestamp.now()}});
    await expect(invoke()).rejects.toMatchObject({code: "failed-precondition"});
    expect(provider.create).not.toHaveBeenCalled(); expect(provider.retrieve).not.toHaveBeenCalled();
  });
  it("denies a different parent before creating a payment attempt", async () => {
    await expect(invoke("other-parent")).rejects.toMatchObject({code: "permission-denied"});
    expect(provider.create).not.toHaveBeenCalled();
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentAttempt")).toBeUndefined();
  });
  it("does not settle a booking from a webhook with a valid but different fee", async () => {
    await invoke(); const original = [...intents.values()][0].intent;
    await reconcile(stripeEvent("evt_wrong_fee", "payment_intent.succeeded", {...original, status: "succeeded", application_fee_amount: 250,
      metadata: {...original.metadata, platformFeeCents: "250"}}));
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentStatus")).not.toBe("paid");
    expect((await firestore.doc("reports/stripe_evt_wrong_fee").get()).get("reconciliationStatus")).toBe("feeMismatch");
    expect((await firestore.collection("rewardLedger").get()).empty).toBe(true);
  });
  it("settles the frozen invoice once even if the current fee configuration has changed", async () => {
    await invoke(); process.env.PLATFORM_FEE_BPS = "2500"; const original = [...intents.values()][0].intent;
    const event = stripeEvent("evt_frozen_fee", "payment_intent.succeeded", {...original, status: "succeeded"});
    await reconcile(event); await reconcile(event);
    expect((await firestore.doc("bookings/booking-1").get()).get("paymentStatus")).toBe("paid");
    const entries = (await firestore.collection("rewardLedger").get()).docs.map(doc => doc.data());
    expect(entries).toHaveLength(2);
    expect(entries.find(row => row.type === "driverEarning")?.amountCents).toBe(900);
    expect(entries.find(row => row.type === "ridePayment")?.amountCents).toBe(-1000);
  });
});
