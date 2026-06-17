#!/usr/bin/env node
import { checkStripeProductionReadiness } from "./lib/stripe-production-readiness.mjs";

try {
  const result = await checkStripeProductionReadiness();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
