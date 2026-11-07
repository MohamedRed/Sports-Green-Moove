import { describe, expect, it, vi } from "vitest";
import {
  beginStripeOnboarding, onboardingTokenHash, resolveStripeOnboardingCallback,
  stripeOnboardingCallbacks, type OnboardingDependencies, type OnboardingSession,
} from "../domain/stripeOnboarding.js";
import { renderStripeOnboardingPage } from "../views/stripeOnboardingPage.js";

function fixture() {
  const sessions = new Map<string, OnboardingSession>();
  const dependencies: OnboardingDependencies = {
    saveSession: vi.fn(async (hash, session) => { sessions.set(hash, session); }),
    loadSession: vi.fn(async (hash) => sessions.get(hash)),
    createLink: vi.fn(async () => ({ url: "https://connect.stripe.com/setup/s/test-link", expiresAt: "123" })),
    retrieveAccount: vi.fn(async (id) => ({ id, charges_enabled: true, payouts_enabled: true, details_submitted: true })),
    saveAccountStatus: vi.fn(async () => undefined),
  };
  return { dependencies, sessions };
}

async function started() {
  const state = fixture();
  await beginStripeOnboarding("driver-1", "acct_driver", state.dependencies, 1000);
  const input = vi.mocked(state.dependencies.createLink).mock.calls[0][0];
  const token = new URL(input.returnUrl).searchParams.get("state")!;
  return { ...state, input, token };
}

describe("Stripe hosted onboarding callbacks", () => {
  it("binds an opaque, expiring token to the authenticated driver's account without persisting the token", async () => {
    const { token, sessions, input } = await started();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...sessions.entries()]).toEqual([[onboardingTokenHash(token), {
      userId: "driver-1", stripeAccountId: "acct_driver", expiresAt: 1_801_000,
    }]]);
    expect(JSON.stringify([...sessions])).not.toContain(token);
    expect(new URL(input.returnUrl).origin + new URL(input.returnUrl).pathname).toBe(stripeOnboardingCallbacks.returnUrl);
    expect(new URL(input.refreshUrl).searchParams.get("state")).toBe(token);
    expect(input.accountId).toBe("acct_driver");
  });

  it("refreshes expired Stripe Account Links with the same trusted parameters", async () => {
    const { token, input, dependencies } = await started();
    expect(await resolveStripeOnboardingCallback("refresh", token, dependencies, 2000)).toEqual({
      status: 303, redirect: "https://connect.stripe.com/setup/s/test-link",
    });
    expect(vi.mocked(dependencies.createLink).mock.calls[1][0]).toEqual(input);
    expect(dependencies.retrieveAccount).not.toHaveBeenCalled();
  });

  it("checks Stripe status on return and persists the actual capabilities", async () => {
    const { token, dependencies } = await started();
    expect(await resolveStripeOnboardingCallback("return", token, dependencies, 2000)).toEqual({ status: 200, page: "ready" });
    expect(dependencies.retrieveAccount).toHaveBeenCalledWith("acct_driver");
    expect(dependencies.saveAccountStatus).toHaveBeenCalledOnce();
  });

  it.each([
    { charges_enabled: false }, { payouts_enabled: false }, { details_submitted: false },
    { requirements: { currently_due: ["individual.id_number"] } },
    { requirements: { pending_verification: ["individual.verification.document"] } },
  ])("does not equate a Stripe return redirect with completed onboarding: %j", async (incomplete) => {
    const { token, dependencies } = await started();
    vi.mocked(dependencies.retrieveAccount).mockResolvedValue({
      id: "acct_driver", charges_enabled: true, payouts_enabled: true, details_submitted: true, ...incomplete,
    });
    expect(await resolveStripeOnboardingCallback("return", token, dependencies, 2000)).toEqual({ status: 200, page: "pending" });
  });

  it.each([undefined, "", "bad-token", ["token"], "<script>"])("rejects malformed state without a database read: %j", async (token) => {
    const { dependencies } = fixture();
    expect(await resolveStripeOnboardingCallback("return", token, dependencies)).toEqual({ status: 400, page: "invalid" });
    expect(dependencies.loadSession).not.toHaveBeenCalled();
    expect(dependencies.retrieveAccount).not.toHaveBeenCalled();
  });

  it("rejects unknown, expired, and non-finite sessions before contacting Stripe", async () => {
    const { token, sessions, dependencies } = await started();
    expect(await resolveStripeOnboardingCallback("refresh", "a".repeat(43), dependencies, 2000)).toEqual({ status: 400, page: "invalid" });
    expect(await resolveStripeOnboardingCallback("refresh", token, dependencies, 1_801_000)).toEqual({ status: 400, page: "invalid" });
    sessions.get(onboardingTokenHash(token))!.expiresAt = NaN;
    expect(await resolveStripeOnboardingCallback("return", token, dependencies, 2000)).toEqual({ status: 400, page: "invalid" });
    expect(dependencies.createLink).toHaveBeenCalledTimes(1);
  });

  it.each(["http://connect.stripe.com/setup/x", "https://evil.example/setup/x", "https://connect.stripe.com.evil.example/setup/x", "https://connect.stripe.com/not-onboarding"])("rejects an unexpected redirect destination: %s", async (url) => {
    const { token, dependencies } = await started();
    vi.mocked(dependencies.createLink).mockResolvedValue({ url });
    await expect(resolveStripeOnboardingCallback("refresh", token, dependencies, 2000)).rejects.toThrow("Unexpected Stripe onboarding");
  });

  it("rejects account mismatches and does not hide upstream failures", async () => {
    const { token, dependencies } = await started();
    vi.mocked(dependencies.retrieveAccount).mockResolvedValue({ id: "acct_other", charges_enabled: true, payouts_enabled: true, details_submitted: true });
    await expect(resolveStripeOnboardingCallback("return", token, dependencies, 2000)).rejects.toThrow("account mismatch");
    expect(dependencies.saveAccountStatus).not.toHaveBeenCalled();
    vi.mocked(dependencies.createLink).mockRejectedValue(new Error("Stripe unavailable"));
    await expect(resolveStripeOnboardingCallback("refresh", token, dependencies, 2000)).rejects.toThrow("Stripe unavailable");
  });

  it("renders only fixed French copy and a credential-free application return link", () => {
    for (const state of ["ready", "pending", "invalid", "unavailable"] as const) {
      const page = renderStripeOnboardingPage(state);
      expect(page).toContain('lang="fr"');
      expect(page).toContain('href="sports-green-moove://payments"');
      expect(page).not.toContain("acct_");
      expect(page).not.toContain("state=");
    }
  });
});
