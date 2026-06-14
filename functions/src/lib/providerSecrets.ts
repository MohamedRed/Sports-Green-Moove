import { defineSecret } from "firebase-functions/params";

export const radarWebhookSecret = defineSecret("RADAR_WEBHOOK_SECRET");
export const stripeSecretKeySecret = defineSecret("STRIPE_SECRET_KEY");
export const stripePublishableKeySecret = defineSecret("STRIPE_PUBLISHABLE_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

