import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { writeLiveLocation } from "./callables/locations.js";
import { radarEventToLocationUpdate, verifyRadarSignature } from "./services/radar.js";
import { createStripeClient } from "./services/stripeConnect.js";
import { reconcileStripeEvent } from "./services/stripeReconciliation.js";

export const radarWebhook = onRequest(async (req, res) => {
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const signature = req.header("x-radar-signature") ?? req.header("radar-signature");
  if (!verifyRadarSignature(rawBody, signature)) {
    res.status(401).send("invalid signature");
    return;
  }

  const update = radarEventToLocationUpdate(req.body);
  if (update) {
    await writeLiveLocation(update);
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
