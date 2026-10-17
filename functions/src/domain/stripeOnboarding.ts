import { createHash, randomBytes } from "node:crypto";
import callbacks from "../config/stripeOnboarding.json" with { type: "json" };

export { callbacks as stripeOnboardingCallbacks };

export type OnboardingSession = {
  userId: string;
  stripeAccountId: string;
  expiresAt: number;
};

export type OnboardingAccount = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements?: { currently_due?: string[] | null; pending_verification?: string[] | null } | null;
};

export type OnboardingDependencies = {
  saveSession: (hash: string, session: OnboardingSession) => Promise<void>;
  loadSession: (hash: string) => Promise<OnboardingSession | undefined>;
  createLink: (input: { accountId: string; returnUrl: string; refreshUrl: string }) => Promise<{ url: string; expiresAt?: string }>;
  retrieveAccount: (id: string) => Promise<OnboardingAccount>;
  saveAccountStatus: (session: OnboardingSession, account: OnboardingAccount) => Promise<void>;
};

export function onboardingTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function onboardingLinkInput(accountId: string, token: string) {
  const withState = (base: string) => {
    const url = new URL(base);
    url.searchParams.set("state", token);
    return url.toString();
  };
  return { accountId, returnUrl: withState(callbacks.returnUrl), refreshUrl: withState(callbacks.refreshUrl) };
}

export async function beginStripeOnboarding(
  userId: string,
  stripeAccountId: string,
  dependencies: OnboardingDependencies,
  now = Date.now(),
) {
  const token = randomBytes(32).toString("base64url");
  await dependencies.saveSession(onboardingTokenHash(token), {
    userId, stripeAccountId, expiresAt: now + 30 * 60 * 1000,
  });
  return dependencies.createLink(onboardingLinkInput(stripeAccountId, token));
}

export type CallbackResult = {
  status: number;
  page?: "invalid" | "pending" | "ready" | "unavailable";
  redirect?: string;
};

export async function resolveStripeOnboardingCallback(
  kind: "return" | "refresh",
  token: unknown,
  dependencies: OnboardingDependencies,
  now = Date.now(),
): Promise<CallbackResult> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { status: 400, page: "invalid" };
  }
  const session = await dependencies.loadSession(onboardingTokenHash(token));
  if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
    return { status: 400, page: "invalid" };
  }
  if (kind === "refresh") {
    const link = await dependencies.createLink(onboardingLinkInput(session.stripeAccountId, token));
    const destination = new URL(link.url);
    if (destination.origin !== "https://connect.stripe.com" || !destination.pathname.startsWith("/setup/")) {
      throw new Error("Unexpected Stripe onboarding destination.");
    }
    return { status: 303, redirect: destination.toString() };
  }
  const account = await dependencies.retrieveAccount(session.stripeAccountId);
  if (account.id !== session.stripeAccountId) throw new Error("Stripe onboarding account mismatch.");
  await dependencies.saveAccountStatus(session, account);
  const ready = account.charges_enabled && account.payouts_enabled && account.details_submitted
    && !account.requirements?.currently_due?.length && !account.requirements?.pending_verification?.length;
  return { status: 200, page: ready ? "ready" : "pending" };
}
