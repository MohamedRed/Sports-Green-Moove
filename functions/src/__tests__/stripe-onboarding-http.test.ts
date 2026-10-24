import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveCallback = vi.hoisted(() => vi.fn());
const secretValue = vi.hoisted(() => vi.fn(() => "test-secret"));
vi.mock("firebase-functions/v2/https", () => ({ onRequest: (_options: unknown, handler: unknown) => handler }));
vi.mock("../domain/stripeOnboarding.js", async (importOriginal) => ({
  ...await importOriginal<object>(), resolveStripeOnboardingCallback: resolveCallback,
}));
vi.mock("../lib/providerSecrets.js", () => ({ stripeSecretKeySecret: { value: secretValue } }));
vi.mock("../services/stripeOnboarding.js", () => ({ stripeOnboardingDependencies: () => ({}) }));
import { stripeConnectRefresh, stripeConnectReturn } from "../stripeOnboardingCallbacks.js";

function response() {
  const result = {
    set: vi.fn(), status: vi.fn(), type: vi.fn(), send: vi.fn(), end: vi.fn(), redirect: vi.fn(),
  };
  for (const method of Object.values(result)) method.mockReturnValue(result);
  return result;
}

async function invoke(handler: typeof stripeConnectReturn, request: object, result = response()) {
  await handler(request as Parameters<typeof handler>[0], result as unknown as Parameters<typeof handler>[1]);
  return result;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("Stripe callback HTTP boundary", () => {
  it.each([[stripeConnectReturn, "return"], [stripeConnectRefresh, "refresh"]] as const)("exposes read-only health without reading secrets or contacting Stripe", async (handler, kind) => {
    const result = await invoke(handler, { method: "GET", query: { health: "1" } });
    expect(result.status).toHaveBeenCalledWith(204);
    expect(result.set).toHaveBeenCalledWith(expect.objectContaining({
      "X-SGM-Stripe-Callback": kind, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    }));
    expect(secretValue).not.toHaveBeenCalled();
    expect(resolveCallback).not.toHaveBeenCalled();
  });

  it("rejects mutation methods without touching provider state", async () => {
    const result = await invoke(stripeConnectRefresh, { method: "POST", query: {} });
    expect(result.status).toHaveBeenCalledWith(405);
    expect(result.set).toHaveBeenCalledWith("Allow", "GET");
    expect(resolveCallback).not.toHaveBeenCalled();
  });

  it("redirects refresh only to the domain-validated server result", async () => {
    resolveCallback.mockResolvedValue({ status: 303, redirect: "https://connect.stripe.com/setup/s/example" });
    const result = await invoke(stripeConnectRefresh, { method: "GET", query: { state: "opaque-state" } });
    expect(result.redirect).toHaveBeenCalledWith(303, "https://connect.stripe.com/setup/s/example");
    expect(result.send).not.toHaveBeenCalled();
  });

  it("renders invalid and incomplete results without claiming completion", async () => {
    resolveCallback.mockResolvedValue({ status: 400, page: "invalid" });
    const result = await invoke(stripeConnectReturn, { method: "GET", query: {} });
    expect(result.status).toHaveBeenCalledWith(400);
    expect(result.send.mock.calls[0][0]).toContain("CE LIEN A EXPIR");
  });

  it("redacts upstream errors and state from failure responses", async () => {
    resolveCallback.mockRejectedValue(new Error("sk_secret acct_customer opaque-state"));
    const result = await invoke(stripeConnectReturn, { method: "GET", query: { state: "opaque-state" } });
    expect(result.status).toHaveBeenCalledWith(503);
    const body = result.send.mock.calls[0][0];
    for (const sensitive of ["sk_secret", "acct_customer", "opaque-state"]) expect(body).not.toContain(sensitive);
  });
});
