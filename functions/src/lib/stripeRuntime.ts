import { defineSecret } from "firebase-functions/params";

export const stripeSecretKeySecret = defineSecret("STRIPE_SECRET_KEY");
export const stripePublishableKeySecret = defineSecret("STRIPE_PUBLISHABLE_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

