import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { paymentFeeBasisPoints, paymentFeeCents, verifiedIntentFee } from "../domain/paymentFees.js";
import { validateSucceededRidePaymentIntent } from "../services/stripePaymentValidation.js";

describe("invoice fee boundaries", () => {
  it("keeps the documented unconfigured zero fee without treating malformed configuration as zero", () => {
    expect(paymentFeeBasisPoints(undefined)).toBe(0);
    expect(paymentFeeBasisPoints("0")).toBe(0); expect(paymentFeeBasisPoints("10000")).toBe(10000);
  });
  it.each(["", " ", "-1", "+1", "1.5", "1e3", "0x10", "01", "10001", "NaN", "Infinity", "undefined"])(
    "rejects malformed fee configuration %j", value => {expect(() => paymentFeeBasisPoints(value)).toThrow();});
  it("rounds half cents upwards using exact arithmetic even at safe-integer boundaries", () => {
    expect(paymentFeeCents(5, 1000)).toBe(1); expect(paymentFeeCents(4, 1000)).toBe(0);
    expect(paymentFeeCents(1000, 2500)).toBe(250);
    expect(paymentFeeCents(Number.MAX_SAFE_INTEGER, 10000)).toBe(Number.MAX_SAFE_INTEGER);
    expect(paymentFeeCents(Number.MAX_SAFE_INTEGER, 9999)).toBe(Number((BigInt(Number.MAX_SAFE_INTEGER) * 9999n + 5000n) / 10000n));
  });
  it.each([[0, 100], [-1, 100], [1.5, 100], [Infinity, 100], [Number.MAX_SAFE_INTEGER + 1, 100],
    [1000, -1], [1000, 10001], [1000, NaN], [1000, 1.5]])("rejects unsafe invoice/rate %j", (amount, rate) => {
    expect(() => paymentFeeCents(amount, rate)).toThrow();
  });
  const intent = {id: "pi_invoice", amount: 1000, currency: "eur", application_fee_amount: 100,
    metadata: {platformFeeCents: "100", bookingId: "booking", tripId: "trip", payerUserId: "parent", driverUserId: "driver",
      paymentAttemptId: "attempt", product: "sports-green-moove"}} as Stripe.PaymentIntent;
  it("requires provider fee and canonical metadata to agree", () => {
    expect(verifiedIntentFee(intent)).toBe(100);
    expect(verifiedIntentFee({...intent, application_fee_amount: null, metadata: {...intent.metadata, platformFeeCents: "0"}})).toBe(0);
  });
  it.each(["", "-1", "1.5", "100.0", "0100", "1001", "NaN", "9007199254740992"])("rejects invalid fee metadata %j", value => {
    expect(verifiedIntentFee({...intent, metadata: {...intent.metadata, platformFeeCents: value}})).toBeNull();
  });
  it.each([null, -1, 99, 101, 100.5, Infinity, NaN])("rejects a mismatching actual fee %j", value => {
    expect(verifiedIntentFee({...intent, application_fee_amount: value})).toBeNull();
  });
  it("rejects a successful webhook whose valid fee differs from the stored invoice", () => {
    const booking = {id: "booking", tripId: "trip", parentUserId: "parent", driverUserId: "driver", seats: 1,
      paymentPriceCents: 1000, paymentAttempt: {id: "attempt", platformFeeCents: 50}};
    expect(validateSucceededRidePaymentIntent(intent, booking, {id: "trip"})).toMatchObject({ok: false, reconciliationStatus: "feeMismatch"});
    expect(validateSucceededRidePaymentIntent(intent, {...booking, paymentAttempt: {...booking.paymentAttempt, platformFeeCents: 100}}, {id: "trip"})).toMatchObject({ok: true});
  });
});
