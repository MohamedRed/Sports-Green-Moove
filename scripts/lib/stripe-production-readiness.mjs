import { checkConnectCallback, listWebhookEndpoints, stripeGet } from "./stripe-readiness-http.mjs";
import callbacks from "../../functions/src/config/stripeOnboarding.json" with { type: "json" };

const productionWebhookUrl = "https://us-central1-sports-green-moove-prod.cloudfunctions.net/stripeWebhook";
const requiredEvents = [
  "payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled",
  "account.updated", "transfer.created", "transfer.updated", "transfer.reversed",
];

export async function checkStripeProductionReadiness({
  env = process.env,
  fetcher = fetch,
} = {}) {
  const config = loadConfig(env);
  const [account, balance, webhookEndpoints, connectAccounts] = await Promise.all([
    stripeGet(fetcher, config.secretKey, "/v1/account"),
    stripeGet(fetcher, config.secretKey, "/v1/balance"),
    listWebhookEndpoints(fetcher, config.secretKey),
    stripeGet(fetcher, config.secretKey, "/v1/accounts?limit=1"),
  ]);

  const stripeWebhookEndpoints = webhookEndpoints.filter((endpoint) =>
    endpoint.status === "enabled" && endpoint.livemode === true && endpoint.url === productionWebhookUrl,
  );

  if (balance.livemode !== true) {
    throw new Error("Stripe live secret key did not return a live-mode balance.");
  }
  if (stripeWebhookEndpoints.length === 0) {
    throw new Error("No enabled live Stripe webhook endpoint targets the production stripeWebhook URL.");
  }
  const events = new Set(stripeWebhookEndpoints.flatMap((endpoint) => endpoint.enabled_events ?? []));
  const missingEvents = requiredEvents.filter((event) => !events.has("*") && !events.has(event));
  if (missingEvents.length) throw new Error(`Stripe webhook events missing: ${missingEvents.join(", ")}.`);
  if (account.charges_enabled !== true || account.payouts_enabled !== true || account.details_submitted !== true) {
    throw new Error("Stripe platform charges, payouts, and submitted details must all be enabled.");
  }
  if (!Array.isArray(connectAccounts.data)) {
    throw new Error("Stripe Connect account list endpoint did not return a data array.");
  }
  const [returnCallback, refreshCallback] = await Promise.all([
    checkConnectCallback(fetcher, config.returnUrl, "SGM_STRIPE_CONNECT_RETURN_URL"),
    checkConnectCallback(fetcher, config.refreshUrl, "SGM_STRIPE_CONNECT_REFRESH_URL"),
  ]);

  return {
    ok: true,
    readinessStatus: "production-configured",
    account: {
      id: account.id,
      country: account.country,
      defaultCurrency: account.default_currency,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
    balance: {
      livemode: balance.livemode,
      availableCurrencyCount: uniqueCurrencies(balance.available).length,
      pendingCurrencyCount: uniqueCurrencies(balance.pending).length,
    },
    webhookEndpoints: stripeWebhookEndpoints.map((endpoint) => ({
      id: endpoint.id,
      status: endpoint.status,
      urlHost: safeHost(endpoint.url),
      eventCount: endpoint.enabled_events?.length ?? 0,
      apiVersion: endpoint.api_version,
    })),
    connectAccounts: {
      reachable: true,
      returnedAccountCount: connectAccounts.data.length,
      hasMore: Boolean(connectAccounts.has_more),
    },
    connectUrls: {
      returnUrlHost: safeHost(config.returnUrl),
      refreshUrlHost: safeHost(config.refreshUrl),
      returnCallback,
      refreshCallback,
    },
  };
}

function loadConfig(env) {
  const config = {
    secretKey: required(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY"),
    publishableKey: required(env.STRIPE_PUBLISHABLE_KEY, "STRIPE_PUBLISHABLE_KEY"),
    webhookSecret: required(env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET"),
    returnUrl: required(env.SGM_STRIPE_CONNECT_RETURN_URL, "SGM_STRIPE_CONNECT_RETURN_URL"),
    refreshUrl: required(env.SGM_STRIPE_CONNECT_REFRESH_URL, "SGM_STRIPE_CONNECT_REFRESH_URL"),
  };

  assertPrefix(config.secretKey, "sk_live_", "STRIPE_SECRET_KEY");
  assertPrefix(config.publishableKey, "pk_live_", "STRIPE_PUBLISHABLE_KEY");
  assertPrefix(config.webhookSecret, "whsec_", "STRIPE_WEBHOOK_SECRET");
  assertHttpsUrl(config.returnUrl, "SGM_STRIPE_CONNECT_RETURN_URL");
  assertHttpsUrl(config.refreshUrl, "SGM_STRIPE_CONNECT_REFRESH_URL");
  if (config.returnUrl !== callbacks.returnUrl || config.refreshUrl !== callbacks.refreshUrl) {
    throw new Error("Stripe callbacks must use the configured primary Firebase Hosting endpoints.");
  }

  return config;
}

function uniqueCurrencies(items) {
  return [...new Set((items ?? []).map((item) => item.currency).filter(Boolean))];
}

function safeHost(url) {
  return new URL(url).host;
}

function required(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function assertPrefix(value, prefix, name) {
  if (!value.startsWith(prefix)) {
    throw new Error(`${name} must start with ${prefix}.`);
  }
}

function assertHttpsUrl(value, name) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use https.`);
  }
}
