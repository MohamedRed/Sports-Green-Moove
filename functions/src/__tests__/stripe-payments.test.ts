import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  buildConnectedAccountLinkCreateBody,
  buildRewardPayoutTransferCreateParams,
  buildRidePaymentIntentCreateParams,
  stripePublishableKey,
} from "../services/stripeConnect.js";
import { buildRidePaymentLedgerEntries } from "../services/stripeLedger.js";
import {
  shouldApplyIncompletePaymentStatus,
  validateSucceededRidePaymentIntent,
} from "../services/stripePaymentValidation.js";

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
      platformFeeCents: "0",
      product: "sports-green-moove",
    });
  });

  it("creates parent payment and driver earning ledger drafts from frozen PaymentIntent fee metadata", () => {
    const previousFee = process.env.PLATFORM_FEE_BPS;
    process.env.PLATFORM_FEE_BPS = "2500";
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
          platformFeeCents: "100",
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

  it("rejects ledger drafts when platform fee metadata is missing", () => {
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

    expect(buildRidePaymentLedgerEntries(intent)).toEqual([]);
  });

  it("validates succeeded PaymentIntent metadata against booking and trip state", () => {
    const intent = {
      id: "pi_123",
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
    } as Stripe.PaymentIntent;

    expect(validateSucceededRidePaymentIntent(
      intent,
      {
        id: "booking-1",
        tripId: "trip-1",
        parentUserId: "parent-1",
        driverUserId: "driver-1",
        seats: 2,
        paymentIntentId: "pi_123",
      },
      { id: "trip-1", priceCents: 250 },
    )).toMatchObject({ ok: true, amountCents: 500, parentUserId: "parent-1" });

    expect(validateSucceededRidePaymentIntent(
      { ...intent, amount: 400 } as Stripe.PaymentIntent,
      {
        id: "booking-1",
        tripId: "trip-1",
        parentUserId: "parent-1",
        driverUserId: "driver-1",
        seats: 2,
        paymentIntentId: "pi_123",
      },
      { id: "trip-1", priceCents: 250 },
    )).toMatchObject({ ok: false, reconciliationStatus: "amountMismatch" });
  });

  it("does not downgrade paid bookings from incomplete PaymentIntent events", () => {
    const intent = {
      id: "pi_123",
      amount: 500,
      currency: "eur",
      metadata: {
        bookingId: "booking-1",
        product: "sports-green-moove",
      },
    } as Stripe.PaymentIntent;

    expect(shouldApplyIncompletePaymentStatus(intent, {
      id: "booking-1",
      paymentIntentId: "pi_123",
      paymentStatus: "paid",
    })).toMatchObject({ ok: false, reconciliationStatus: "paidBookingUnchanged" });
  });

  it("requires a Stripe publishable key before issuing native PaymentSheet config", () => {
    expect(stripePublishableKey("pk_test_sgm")).toBe("pk_test_sgm");
    expect(() => stripePublishableKey("")).toThrow("STRIPE_PUBLISHABLE_KEY is required");
  });

  it("builds an Accounts v2 onboarding link request", () => {
    expect(buildConnectedAccountLinkCreateBody({
      accountId: "acct_driver",
      refreshUrl: "https://app.sgm.test/refresh",
      returnUrl: "https://app.sgm.test/return",
    })).toEqual({
      account: "acct_driver",
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          refresh_url: "https://app.sgm.test/refresh",
          return_url: "https://app.sgm.test/return",
        },
      },
    });
  });

  it("builds an idempotent reward payout transfer", () => {
    const request = buildRewardPayoutTransferCreateParams({
      userId: "driver-1",
      amountCents: 750,
      currency: "eur",
      destinationStripeAccountId: "acct_driver",
      sourceId: "reward-cycle-1",
    });

    expect(request.idempotencyKey).toBe("rewardPayout:driver-1:reward-cycle-1");
    expect(request.params).toMatchObject({
      amount: 750,
      currency: "eur",
      destination: "acct_driver",
      metadata: {
        userId: "driver-1",
        sourceId: "reward-cycle-1",
        product: "sports-green-moove",
      },
    });
  });
});
