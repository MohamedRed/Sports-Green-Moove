import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { tripChangeBookingPrice, routeQuoteSchema, applyTripChangeSchema } from "../domain/tripChangeApplication.js";
import { ridePaymentAmountCents, validateSucceededRidePaymentIntent, shouldApplyIncompletePaymentStatus } from "../services/stripePaymentValidation.js";
import { buildRidePaymentIntentCreateParams } from "../services/stripeConnect.js";

describe("trip application financial terms", () => {
  it("records only the unpaid difference of an already paid booking without rewriting its invoice", () => {
    expect(tripChangeBookingPrice({ seats: 2, paymentStatus: "paid", amountPaidCents: 500 }, 250, 400))
      .toEqual({ agreedPriceCents: 400, agreedAmountCents: 800, paidBeforeCents: 500, balanceCents: 300, paymentPriceCents: 250, state: "paymentDue" });
  });
  it("records a refund obligation without claiming it was issued", () => {
    expect(tripChangeBookingPrice({ seats: 1, paymentStatus: "paid", amountPaidCents: 250 }, 250, 100))
      .toMatchObject({ balanceCents: -150, state: "refundDue", paymentPriceCents: 250 });
  });
  it("retains the original payment invoice across later agreed prices", () => {
    expect(tripChangeBookingPrice({ seats: 1, paymentStatus: "paid", amountPaidCents: 400, paymentPriceCents: 250 }, 400, 100))
      .toMatchObject({ balanceCents: -300, paymentPriceCents: 250 });
  });
  it("reprices an unpaid booking without inventing paid money or a payment adjustment", () => {
    expect(tripChangeBookingPrice({ seats: 2, status: "approved" }, 250, 400))
      .toMatchObject({ agreedAmountCents: 800, paidBeforeCents: 0, balanceCents: 0, paymentPriceCents: null, state: "notRequired" });
  });
  it.each([{ seats: 0 }, { seats: 9 }, { seats: 1, paymentStatus: "paid" },
    { seats: 1, paymentStatus: "paid", amountPaidCents: 100 }, { seats: 1, paymentIntentId: "pi_processing" },
    { seats: 1, paymentAttempt: { status: "creating" } }, { seats: 1, tripChangeBalanceCents: 1 },
    { seats: 1, paymentStatus: "paid", amountPaidCents: 250, paymentPriceCents: NaN },
  ])("rejects inconsistent or unresolved booking money %j", (booking) => {
    expect(() => tripChangeBookingPrice(booking, 250, 400)).toThrow();
  });
  it("allows a confirmed cancelled checkout to be retired before a new agreed price", () => {
    expect(tripChangeBookingPrice({ seats: 1, paymentStatus: "canceled", paymentIntentId: "pi_cancelled" }, 250, 400).agreedAmountCents).toBe(400);
    for (const price of [-1, 1.5, NaN, Infinity, 100001]) expect(() => tripChangeBookingPrice({ seats: 1 }, 250, price)).toThrow();
  });
  it("requires current quote/revision identities and valid route metrics", () => {
    const input = { tripId: "trip", proposalId: "a".repeat(64), proposalRevision: "b".repeat(64),
      requestId: "11111111-1111-4111-8111-111111111111", quoteId: "c".repeat(64) };
    expect(applyTripChangeSchema.parse(input)).toEqual(input);
    expect(applyTripChangeSchema.safeParse({ ...input, amountPaidCents: 123 }).success).toBe(false);
    expect(routeQuoteSchema.safeParse({ distanceMeters: 0, durationSeconds: 0 }).success).toBe(false);
  });
});

describe("immutable payment attempt validation", () => {
  const intent = { id: "pi", amount: 250, currency: "eur", metadata: { product: "sports-green-moove", bookingId: "booking",
    tripId: "trip", payerUserId: "parent", driverUserId: "driver", paymentAttemptId: "attempt" } } as unknown as Stripe.PaymentIntent;
  const booking = { id: "booking", tripId: "trip", parentUserId: "parent", driverUserId: "driver", seats: 1,
    paymentPriceCents: 250, paymentAttempt: { id: "attempt" } };
  it("validates the original invoice even after current trip price changes", () => {
    expect(ridePaymentAmountCents(booking, { id: "trip", priceCents: 400 })).toBe(250);
    expect(validateSucceededRidePaymentIntent(intent, booking, { id: "trip", priceCents: 400 }).ok).toBe(true);
    expect(validateSucceededRidePaymentIntent({ ...intent, amount: 400 }, booking, { id: "trip", priceCents: 400 }).ok).toBe(false);
  });
  it("rejects another attempt's success and cancellation while the current attempt is being created", () => {
    const old = { ...intent, metadata: { ...intent.metadata, paymentAttemptId: "old-attempt" } };
    expect(validateSucceededRidePaymentIntent(old, booking, { id: "trip", priceCents: 250 })).toMatchObject({ ok: false, reconciliationStatus: "paymentAttemptMismatch" });
    expect(shouldApplyIncompletePaymentStatus(old, booking)).toMatchObject({ ok: false, reconciliationStatus: "paymentAttemptMismatch" });
  });
  it("binds provider idempotency and metadata to the claimed attempt", () => {
    const result = buildRidePaymentIntentCreateParams({ bookingId: "booking", tripId: "trip", payerUserId: "parent",
      driverUserId: "driver", amountCents: 250, currency: "eur", destinationStripeAccountId: "acct", paymentAttemptId: "attempt" });
    expect(result.idempotencyKey).toBe("ridePayment:booking:parent:attempt");
    expect(result.params.metadata?.paymentAttemptId).toBe("attempt");
  });
});
