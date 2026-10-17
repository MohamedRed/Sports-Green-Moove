const stripeApiBaseUrl = "https://api.stripe.com";

export async function stripeGet(fetcher, secretKey, path) {
  let response;
  try {
    response = await fetcher(`${stripeApiBaseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Stripe-Version": "2026-02-25.clover",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`Stripe ${path} could not be reached.`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Stripe ${path} returned invalid JSON.`);
  }
  if (!response.ok) {
    // Provider error messages can echo credentials; expose only HTTP status.
    throw new Error(`Stripe ${path} failed (${response.status}).`);
  }
  return body;
}

export async function listWebhookEndpoints(fetcher, secretKey) {
  const endpoints = [];
  let cursor;
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("starting_after", cursor);
    const body = await stripeGet(fetcher, secretKey, `/v1/webhook_endpoints?${params}`);
    if (!Array.isArray(body?.data)) throw new Error("Stripe webhook list must contain a data array.");
    endpoints.push(...body.data);
    if (body.has_more !== true) return endpoints;
    const nextCursor = body.data.at(-1)?.id;
    if (!nextCursor || nextCursor === cursor) throw new Error("Stripe webhook pagination did not advance.");
    cursor = nextCursor;
  }
  throw new Error("Stripe webhook list exceeded the pagination limit.");
}

export async function checkConnectCallback(fetcher, url, name) {
  let response;
  const healthUrl = new URL(url);
  healthUrl.searchParams.set("health", "1");
  try {
    response = await fetcher(healthUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`${name} callback host ${new URL(url).host} could not be reached.`);
  }
  await response.body?.cancel();
  if (!response.ok) throw new Error(`${name} callback returned HTTP ${response.status}.`);
  if (response.url && new URL(response.url).protocol !== "https:") {
    throw new Error(`${name} callback redirected to an insecure URL.`);
  }
  const kind = name === "SGM_STRIPE_CONNECT_RETURN_URL" ? "return" : "refresh";
  if (response.status !== 204 || response.headers?.get("x-sgm-stripe-callback") !== kind) {
    throw new Error(`${name} does not expose the expected Stripe callback health contract.`);
  }
  return { reachable: true, status: response.status, kind };
}
