import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { normalizeRadarWebhookPayload, verifyRadarSignature } from "./services/radar.js";
import { reconcileRadarEvent } from "./services/radarReconciliation.js";
import { createStripeClient } from "./services/stripeConnect.js";
import { reconcileStripeEvent } from "./services/stripeReconciliation.js";

export const radarWebhook = onRequest(async (req, res) => {
  const signature = req.header("x-radar-signature") ?? req.header("radar-signature");
  const signingId = req.header("x-radar-signing-id");
  if (!verifyRadarSignature(signingId, signature)) {
    res.status(401).send("invalid signature");
    return;
  }

  const events = normalizeRadarWebhookPayload(req.body ?? {});
  for (const event of events) {
    await reconcileRadarEvent(event);
  }

  res.status(204).send();
});

export const stripeWebhook = onRequest(async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.header("stripe-signature");
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  if (!secret || !signature) {
    res.status(400).send("missing signature");
    return;
  }

  try {
    const stripe = createStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    await reconcileStripeEvent(event);

    res.status(204).send();
  } catch (error) {
    logger.error("Stripe webhook failed", error);
    res.status(400).send("webhook error");
  }
});
