import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";

export function createStripeWebhookFixtures(firestore: Firestore, collections: string[]) {
  return {
    async seedRidePaymentContext(bookingOverrides: Record<string, unknown> = {}) {
      await firestore.doc("trips/trip-1").set({ priceCents: 250 });
      await firestore.doc("bookings/booking-1").set({ tripId: "trip-1", parentUserId: "parent-1", driverUserId: "driver-1",
        seats: 2, paymentIntentId: "pi_ride_1", ...bookingOverrides });
    },
    async clearCollections() {
      for (const collection of collections) {
        while (true) {
          const snapshot = await firestore.collection(collection).limit(200).get();
          if (snapshot.empty) break;
          const batch = firestore.batch();
          for (const doc of snapshot.docs) batch.delete(doc.ref);
          await batch.commit();
        }
      }
    },
  };
}

export function ridePaymentIntent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return { id: "pi_ride_1", object: "payment_intent", amount: 500, currency: "eur",
    metadata: { bookingId: "booking-1", tripId: "trip-1", payerUserId: "parent-1", driverUserId: "driver-1",
      platformFeeCents: "0", product: "sports-green-moove" }, ...overrides } as Stripe.PaymentIntent;
}
export function rewardPayoutTransfer(overrides: Record<string, unknown> = {}): Stripe.Event.Data.Object {
  return { id: "tr_payout_1", object: "transfer", amount: 750, amount_reversed: 0, currency: "eur",
    metadata: { userId: "driver-1", sourceId: "cycle-1", product: "sports-green-moove" }, reversed: false,
    ...overrides } as Stripe.Event.Data.Object;
}
export function stripeEvent(id: string, type: Stripe.Event.Type, object: Stripe.Event.Data.Object): Stripe.Event {
  return { id, object: "event", api_version: "2026-05-20.preview", created: 1_765_000_000, data: { object },
    livemode: false, pending_webhooks: 1, request: null, type } as Stripe.Event;
}
