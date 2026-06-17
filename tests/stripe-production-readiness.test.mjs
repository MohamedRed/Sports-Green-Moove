import assert from "node:assert/strict";
import { checkStripeProductionReadiness } from "../scripts/lib/stripe-production-readiness.mjs";

const validEnv = {
  STRIPE_SECRET_KEY: "sk_live_" + "s".repeat(24),
  STRIPE_PUBLISHABLE_KEY: "pk_live_" + "p".repeat(24),
  STRIPE_WEBHOOK_SECRET: "whsec_" + "w".repeat(24),
  SGM_STRIPE_CONNECT_RETURN_URL: "https://app.sportgreenmoove.be/payments/return",
  SGM_STRIPE_CONNECT_REFRESH_URL: "https://app.sportgreenmoove.be/payments/refresh",
};

const responses = {
  "/v1/account": {
    id: "acct_live_123",
    country: "BE",
    default_currency: "eur",
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
  },
  "/v1/balance": {
    livemode: true,
    available: [{ currency: "eur" }],
    pending: [{ currency: "eur" }],
  },
  "/v1/webhook_endpoints?limit=100": {
    data: [{
      id: "we_live_123",
      status: "enabled",
      url: "https://us-central1-sports-green-moove-prod.cloudfunctions.net/stripeWebhook",
      enabled_events: ["payment_intent.succeeded", "transfer.created"],
      api_version: "2026-02-25.clover",
    }],
  },
};

const okFetch = async (url) => {
  const path = new URL(url).pathname + new URL(url).search;
  return {
    ok: true,
    status: 200,
    json: async () => responses[path],
  };
};

const result = await checkStripeProductionReadiness({ env: validEnv, fetcher: okFetch });
assert.equal(result.ok, true);
assert.equal(result.account.id, "acct_live_123");
assert.equal(result.balance.livemode, true);
assert.equal(result.webhookEndpoints[0].urlHost, "us-central1-sports-green-moove-prod.cloudfunctions.net");
assert.equal(result.connectUrls.returnUrlHost, "app.sportgreenmoove.be");

await assert.rejects(
  () => checkStripeProductionReadiness({
    env: { ...validEnv, STRIPE_SECRET_KEY: "sk_test_" + "s".repeat(24) },
    fetcher: okFetch,
  }),
  /STRIPE_SECRET_KEY must start with sk_live_/,
);

await assert.rejects(
  () => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => {
      const path = new URL(url).pathname + new URL(url).search;
      return {
        ok: true,
        status: 200,
        json: async () => path === "/v1/webhook_endpoints?limit=100" ? { data: [] } : responses[path],
      };
    },
  }),
  /No enabled Stripe webhook endpoint points at stripeWebhook/,
);

await assert.rejects(
  () => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => {
      const path = new URL(url).pathname + new URL(url).search;
      return {
        ok: true,
        status: 200,
        json: async () => path === "/v1/balance" ? { ...responses[path], livemode: false } : responses[path],
      };
    },
  }),
  /did not return a live-mode balance/,
);

console.log("Stripe production readiness checks passed.");
