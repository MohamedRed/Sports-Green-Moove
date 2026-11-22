import type Stripe from "stripe";

export function paymentFeeBasisPoints(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error("Payment fee configuration must be whole basis points.");
  const rate = Number(value);
  if (!Number.isSafeInteger(rate) || rate > 10_000) throw new Error("Payment fee configuration is outside the invoice.");
  return rate;
}

export function paymentFeeCents(amountCents: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000)
    throw new Error("Payment fee requires a positive safe invoice and valid basis points.");
  return Number((BigInt(amountCents) * BigInt(basisPoints) + 5_000n) / 10_000n);
}

export function verifiedIntentFee(intent: Stripe.PaymentIntent): number | null {
  const metadata = intent.metadata.platformFeeCents;
  if (typeof metadata !== "string" || !/^(0|[1-9]\d*)$/.test(metadata)) return null;
  const fee = Number(metadata), actual = intent.application_fee_amount ?? 0;
  if (!Number.isSafeInteger(intent.amount) || intent.amount <= 0 || !Number.isSafeInteger(fee) || fee > intent.amount ||
      !Number.isSafeInteger(actual) || actual < 0 || fee !== actual) return null;
  return fee;
}
