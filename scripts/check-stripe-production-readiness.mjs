#!/usr/bin/env node
import { checkStripeProductionReadiness } from "./lib/stripe-production-readiness.mjs";

if (process.argv.length > 2) {
  console.error("Stripe production readiness does not support bypass arguments.");
  process.exit(1);
}

try {
  const result = await checkStripeProductionReadiness();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = sanitizeStripeError(error instanceof Error ? error.message : String(error));
  console.error(message);
  process.exit(1);
}

function sanitizeStripeError(message) {
  return message.replace(/acct_[A-Za-z0-9]+/g, "acct_[redacted]");
}
