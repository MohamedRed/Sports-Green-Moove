#!/usr/bin/env node
import { checkStripeProductionReadiness } from "./lib/stripe-production-readiness.mjs";

const allowPendingProvider = process.argv.includes("--allow-pending-provider");

try {
  const result = await checkStripeProductionReadiness();
  console.log(JSON.stringify(result, null, 2));
  if (result.ok === false && !allowPendingProvider) {
    console.error(result.readinessStatus ?? "Stripe production readiness is pending.");
    process.exit(1);
  }
} catch (error) {
  const message = sanitizeStripeError(error instanceof Error ? error.message : String(error));
  if (allowPendingProvider) {
    console.log(JSON.stringify({
      ok: false,
      status: "pending-provider-enablement",
      reason: message,
    }, null, 2));
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

function sanitizeStripeError(message) {
  return message.replace(/acct_[A-Za-z0-9]+/g, "acct_[redacted]");
}
