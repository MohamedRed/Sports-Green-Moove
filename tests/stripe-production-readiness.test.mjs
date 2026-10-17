import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkStripeProductionReadiness } from "../scripts/lib/stripe-production-readiness.mjs";

const validEnv = {
  STRIPE_SECRET_KEY: "sk_live_" + "s".repeat(24),
  STRIPE_PUBLISHABLE_KEY: "pk_live_" + "p".repeat(24),
  STRIPE_WEBHOOK_SECRET: "whsec_" + "w".repeat(24),
  SGM_STRIPE_CONNECT_RETURN_URL: "https://sports-green-moove-prod.web.app/payments/return",
  SGM_STRIPE_CONNECT_REFRESH_URL: "https://sports-green-moove-prod.web.app/payments/refresh",
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
      livemode: true,
      url: "https://us-central1-sports-green-moove-prod.cloudfunctions.net/stripeWebhook",
      enabled_events: ["*"],
      api_version: "2026-02-25.clover",
    }],
  },
  "/v1/accounts?limit=1": {
    data: [],
    next_page_url: null,
    previous_page_url: null,
  },
};

const okFetch = async (url) => {
  if (new URL(url).host === "sports-green-moove-prod.web.app") {
    assert.equal(new URL(url).searchParams.get("health"), "1");
    return { ok: true, status: 204, url, headers: new Headers({
      "x-sgm-stripe-callback": new URL(url).pathname.endsWith("/return") ? "return" : "refresh",
    }) };
  }
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
assert.equal(result.connectAccounts.reachable, true);
assert.equal(result.connectUrls.returnUrlHost, "sports-green-moove-prod.web.app");

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
  /No enabled live Stripe webhook endpoint targets the production/,
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

await assert.rejects(() => checkStripeProductionReadiness({
  env: validEnv,
  fetcher: async (url) => {
    const path = new URL(url).pathname + new URL(url).search;
    return path === "/v1/accounts?limit=1"
      ? {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: {
              message: "Stripe Connect account listing is not enabled for your livemode merchant acct_123.",
            },
          }),
        }
      : okFetch(url);
  },
}), /Stripe \/v1\/accounts\?limit=1 failed \(400\)/);

await assert.rejects(
  () => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => {
      const path = new URL(url).pathname + new URL(url).search;
      return {
        ok: true,
        status: 200,
        json: async () => path === "/v1/accounts?limit=1" ? { object: "list" } : responses[path],
      };
    },
  }),
  /Stripe Connect account list endpoint did not return a data array/,
);

async function expectInvalidResponse(path, body, pattern) {
  await assert.rejects(() => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => new URL(url).pathname + new URL(url).search === path
      ? { ok: true, status: 200, json: async () => body }
      : okFetch(url),
  }), pattern);
}

const webhook = responses["/v1/webhook_endpoints?limit=100"].data[0];
for (const override of [
  { url: "https://attacker.invalid/stripeWebhook" },
  { url: "https://us-central1-staging.cloudfunctions.net/stripeWebhook" },
  { livemode: false },
  { status: "disabled" },
]) {
  await expectInvalidResponse("/v1/webhook_endpoints?limit=100", {
    data: [{ ...webhook, ...override }],
  }, /No enabled live Stripe webhook/);
}
await expectInvalidResponse("/v1/webhook_endpoints?limit=100", {
  data: [{ ...webhook, enabled_events: ["payment_intent.succeeded"] }],
}, /events missing:.*account.updated.*transfer.reversed/);
for (const field of ["charges_enabled", "payouts_enabled", "details_submitted"]) {
  await expectInvalidResponse("/v1/account", {
    ...responses["/v1/account"], [field]: false,
  }, /must all be enabled/);
}

for (const callbackFailure of [
  async () => { throw new Error("DNS lookup failed with sensitive data"); },
  async (url) => ({ ok: false, status: 404, url }),
  async () => ({ ok: true, status: 200, url: "http://insecure.invalid" }),
]) {
  await assert.rejects(() => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => new URL(url).host === "sports-green-moove-prod.web.app"
      ? callbackFailure(url) : okFetch(url),
  }), /callback.*(could not be reached|HTTP 404|insecure URL)/);
}

const pageRequests = [];
const paginatedResult = await checkStripeProductionReadiness({
  env: validEnv,
  fetcher: async (url, init) => {
    assert.equal(init.method, "GET", "Readiness must never mutate live Stripe resources.");
    const parsed = new URL(url);
    if (parsed.host === "api.stripe.com" && parsed.pathname === "/v1/webhook_endpoints") {
      pageRequests.push(parsed.search);
      return { ok: true, status: 200, json: async () => parsed.searchParams.has("starting_after")
        ? { data: [webhook], has_more: false }
        : { data: [{ id: "we_other", status: "disabled" }], has_more: true } };
    }
    if (parsed.host === "sports-green-moove-prod.web.app") {
      assert.equal(init.headers, undefined, "Stripe credentials must never reach callback hosts.");
    }
    return okFetch(url);
  },
});
assert.equal(paginatedResult.ok, true);
assert.deepEqual(pageRequests, ["?limit=100", "?limit=100&starting_after=we_other"]);

for (const response of [
  { ok: true, status: 200, headers: new Headers() },
  { ok: true, status: 204, headers: new Headers() },
  { ok: true, status: 204, headers: new Headers({ "x-sgm-stripe-callback": "wrong" }) },
]) {
  await assert.rejects(() => checkStripeProductionReadiness({
    env: validEnv,
    fetcher: async (url) => new URL(url).host === "sports-green-moove-prod.web.app" ? response : okFetch(url),
  }), /expected Stripe callback health contract/);
}
await assert.rejects(() => checkStripeProductionReadiness({
  env: { ...validEnv, SGM_STRIPE_CONNECT_RETURN_URL: "https://app.sportgreenmoove.be/payments/return" },
  fetcher: async () => { throw new Error("must not be called"); },
}), /primary Firebase Hosting endpoints/);

await assert.rejects(() => checkStripeProductionReadiness({
  env: validEnv,
  fetcher: async () => ({
    ok: false, status: 401, json: async () => ({ error: { message: validEnv.STRIPE_SECRET_KEY } }),
  }),
}), (error) => !error.message.includes(validEnv.STRIPE_SECRET_KEY) && /401/.test(error.message));

const bypass = spawnSync(process.execPath, ["scripts/check-stripe-production-readiness.mjs", "--allow-pending-provider"], {
  encoding: "utf8", env: {},
});
assert.equal(bypass.status, 1, "The legacy bypass must not turn failed verification green.");
assert.match(bypass.stderr, /does not support bypass/);

const hosting = JSON.parse(readFileSync("firebase.json", "utf8")).hosting;
assert.deepEqual(hosting.rewrites.slice(0, 2).map(({ source, function: handler }) => [source, handler.functionId, handler.region]), [
  ["/payments/return", "stripeConnectReturn", "us-central1"],
  ["/payments/refresh", "stripeConnectRefresh", "us-central1"],
]);
assert.match(readFileSync("android/app/src/main/AndroidManifest.xml", "utf8"), /android:scheme="sports-green-moove" android:host="payments"/);
assert.match(readFileSync("ios/project.yml", "utf8"), /- sports-green-moove/);
assert.match(readFileSync(".github/workflows/android-browserstack.yml", "utf8"), /SGM_RADAR_PUBLISHABLE_KEY: \$\{\{ secrets.SGM_RADAR_PUBLISHABLE_KEY \}\}/);

console.log("Stripe production readiness checks passed.");
