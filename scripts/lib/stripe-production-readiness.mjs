const stripeApiBaseUrl = "https://api.stripe.com";

export async function checkStripeProductionReadiness({
  env = process.env,
  fetcher = fetch,
} = {}) {
  const config = loadConfig(env);
  const [account, balance, webhookEndpoints] = await Promise.all([
    stripeGet(fetcher, config.secretKey, "/v1/account"),
    stripeGet(fetcher, config.secretKey, "/v1/balance"),
    stripeGet(fetcher, config.secretKey, "/v1/webhook_endpoints?limit=100"),
  ]);

  const enabledWebhookEndpoints = (webhookEndpoints.data ?? []).filter((endpoint) => endpoint.status === "enabled");
  const stripeWebhookEndpoints = enabledWebhookEndpoints.filter((endpoint) => {
    return typeof endpoint.url === "string" && endpoint.url.includes("stripeWebhook");
  });

  if (balance.livemode !== true) {
    throw new Error("Stripe live secret key did not return a live-mode balance.");
  }
  if (stripeWebhookEndpoints.length === 0) {
    throw new Error("No enabled Stripe webhook endpoint points at stripeWebhook.");
  }

  return {
    ok: true,
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
    connectUrls: {
      returnUrlHost: safeHost(config.returnUrl),
      refreshUrlHost: safeHost(config.refreshUrl),
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

  return config;
}

async function stripeGet(fetcher, secretKey, path) {
  const response = await fetcher(`${stripeApiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": "2026-02-25.clover",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stripe ${path} failed (${response.status}): ${body.error?.message ?? response.statusText}`);
  }
  return body;
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
