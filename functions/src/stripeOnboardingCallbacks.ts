import { onRequest } from "firebase-functions/v2/https";
import { resolveStripeOnboardingCallback } from "./domain/stripeOnboarding.js";
import { stripeSecretKeySecret } from "./lib/providerSecrets.js";
import { stripeOnboardingDependencies } from "./services/stripeOnboarding.js";
import { renderStripeOnboardingPage } from "./views/stripeOnboardingPage.js";

function callback(kind: "return" | "refresh") {
  return onRequest({ secrets: [stripeSecretKeySecret] }, async (request, response) => {
    response.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-SGM-Stripe-Callback": kind,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    });
    if (request.method !== "GET") {
      response.set("Allow", "GET").status(405).end();
      return;
    }
    if (request.query.health === "1") {
      response.status(204).end();
      return;
    }
    try {
      const result = await resolveStripeOnboardingCallback(
        kind, request.query.state, stripeOnboardingDependencies(stripeSecretKeySecret.value()),
      );
      if (result.redirect) response.redirect(result.status, result.redirect);
      else response.status(result.status).type("html").send(renderStripeOnboardingPage(result.page!));
    } catch {
      // Do not log callback state or provider errors containing sensitive account data.
      response.status(503).type("html").send(renderStripeOnboardingPage("unavailable"));
    }
  });
}

export const stripeConnectReturn = callback("return");
export const stripeConnectRefresh = callback("refresh");
