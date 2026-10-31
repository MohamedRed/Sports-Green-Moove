import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { paymentReceiptFor, paymentReceiptSchema, samePaymentReceipt } from "../domain/paymentReceipts.js";
import { matchesSupplementIntent, type PreparedSupplement } from "../domain/tripChangePayments.js";
import { buildSupplementIntent } from "../services/tripChangePaymentParams.js";
import { buildRidePaymentLedgerEntries } from "../services/stripeLedger.js";

const attempt = { id: "11111111-1111-4111-8111-111111111111", amountCents: 150, platformFeeCents: 10,
  destinationStripeAccountId: "acct", status: "creating" as const, createdAt: Timestamp.now() };
const prepared: PreparedSupplement = { balanceId: "b".repeat(64), bookingId: "booking", tripId: "trip", payerUserId: "parent",
  driverUserId: "driver", amountCents: 150, currency: "eur", platformFeeCents: 10, destinationStripeAccountId: "acct",
  paymentAttemptId: attempt.id, attempt };
const balance = { bookingId: "booking", tripId: "trip", parentUserId: "parent", driverUserId: "driver", paymentAttempt: attempt };
const request = buildSupplementIntent(prepared);
const intent = { id: "pi_supplement", amount: 150, currency: "eur", application_fee_amount: 10, metadata: request.params.metadata,
  transfer_data: { destination: "acct" }, status: "succeeded" } as unknown as Stripe.PaymentIntent;

describe("supplement invoice and immutable receipts", () => {
  it("prices only the frozen difference and binds fee, destination, request purpose and idempotency", () => {
    expect(request.params.amount).toBe(150); expect(request.params.application_fee_amount).toBe(10);
    expect(request.params.metadata).toMatchObject({ paymentPurpose: "tripChange", balanceId: prepared.balanceId, paymentAttemptId: attempt.id });
    expect(request.idempotencyKey).toBe(`tripChangePayment:${prepared.balanceId}:${attempt.id}`);
    expect(matchesSupplementIntent(intent, prepared.balanceId, balance)).toBe(true);
  });
  it.each([{ amount: 250 }, { currency: "usd" }, { application_fee_amount: 0 },
    { transfer_data: { destination: "other" } }, { metadata: { ...intent.metadata, balanceId: "other" } },
    { metadata: { ...intent.metadata, payerUserId: "other" } }, { metadata: { ...intent.metadata, paymentAttemptId: "other" } },
    { metadata: { ...intent.metadata, platformFeeCents: "0" } }, { metadata: { ...intent.metadata, paymentPurpose: "original" } },
  ])("rejects different provider terms %j", (fields) => {
    expect(matchesSupplementIntent({ ...intent, ...fields } as Stripe.PaymentIntent, prepared.balanceId, balance)).toBe(false);
  });
  it("binds known intent ids and stores no reusable payment secret", () => {
    expect(matchesSupplementIntent(intent, prepared.balanceId, { ...balance, paymentAttempt: { ...attempt, intentId: "pi_other" } })).toBe(false);
    const receipt = paymentReceiptFor({ ...intent, client_secret: "not-for-storage" }, "tripChange", prepared.balanceId);
    expect(receipt).toMatchObject({ amountCents: 150, platformFeeCents: 10, refundedCents: 0, refundReservedCents: 0, kind: "tripChange" });
    expect(JSON.stringify(receipt)).not.toContain("not-for-storage");
    expect(samePaymentReceipt({ ...receipt, refundedCents: 50, createdAt: Timestamp.fromMillis(0) }, receipt)).toBe(true);
    expect(samePaymentReceipt({ ...receipt, amountCents: 151 }, receipt)).toBe(false);
  });
  it.each([NaN, Infinity, -1, 151, 0.5])("rejects invalid platform fee %s before provider use", (platformFeeCents) => {
    expect(() => buildSupplementIntent({ ...prepared, platformFeeCents })).toThrow();
  });
  it("rejects over-refunds, invalid fee metadata and ledger amounts", () => {
    const receipt = paymentReceiptFor(intent, "original");
    expect(paymentReceiptSchema.safeParse({ ...receipt, refundedCents: 100, refundReservedCents: 51 }).success).toBe(false);
    expect(() => paymentReceiptFor({ ...intent, metadata: { ...intent.metadata, platformFeeCents: "Infinity" } }, "original")).toThrow();
    for (const fee of ["151", "999999999999999999999999"]) expect(buildRidePaymentLedgerEntries({ ...intent,
      metadata: { ...intent.metadata, platformFeeCents: fee } })).toEqual([]);
  });
});
