import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";

export function stripeReport(event: Stripe.Event) {
  return {
    type: "stripeWebhook",
    eventId: event.id,
    eventType: event.type,
    createdAt: Timestamp.now(),
  };
}
