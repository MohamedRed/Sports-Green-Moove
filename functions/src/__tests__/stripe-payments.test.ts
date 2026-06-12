import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { buildRidePaymentIntentCreateParams, stripePublishableKey } from "../services/stripeConnect.js";
import { buildRidePaymentLedgerEntries } from "../services/stripeLedger.js";

describe("Stripe ride payments", () => {
  it("builds a destination charge PaymentIntent from server-owned booking context", () => {
    const request = buildRidePaymentIntentCreateParams({
      bookingId: "booking-1",
      tripId: "trip-1",
      payerUserId: "parent-1",
      driverUserId: "driver-1",
      amountCents: 250,
      currency: "eur",
      destinationStripeAccountId: "acct_driver",
    });

    expect(request.idempotencyKey).toBe("ridePayment:booking-1:parent-1");
    expect(request.params.amount).toBe(250);
    expect(request.params.transfer_data).toEqual({ destination: "acct_driver" });
    expect(request.params.metadata).toMatchObject({
      bookingId: "booking-1",
      payerUserId: "parent-1",
      driverUserId: "driver-1",
      product: "sports-green-moove",
    });
  });

  it("creates parent payment and driver earning ledger drafts from a succeeded PaymentIntent", () => {
    const previousFee = process.env.PLATFORM_FEE_BPS;
    process.env.PLATFORM_FEE_BPS = "1000";
    try {
      const intent = {
        id: "pi_123",
        amount: 1000,
        currency: "eur",
        metadata: {
          bookingId: "booking-1",
          tripId: "trip-1",
          payerUserId: "parent-1",
          driverUserId: "driver-1",
          product: "sports-green-moove",
        },
      } as Stripe.PaymentIntent;

      const entries = buildRidePaymentLedgerEntries(intent);

      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ userId: "parent-1", type: "ridePayment", amountCents: -1000 });
      expect(entries[1]).toMatchObject({ userId: "driver-1", type: "driverEarning", amountCents: 900 });
    } finally {
      process.env.PLATFORM_FEE_BPS = previousFee;
    }
  });

  it("requires a Stripe publishable key before issuing native PaymentSheet config", () => {
    expect(stripePublishableKey("pk_test_sgm")).toBe("pk_test_sgm");
    expect(() => stripePublishableKey("")).toThrow("STRIPE_PUBLISHABLE_KEY is required");
  });
});
