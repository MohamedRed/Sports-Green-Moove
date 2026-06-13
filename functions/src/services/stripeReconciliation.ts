import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { firestore } from "../lib/firebase.js";
import { buildRidePaymentLedgerEntries } from "./stripeLedger.js";
import { isTransferEvent, reconcilePayoutTransfer } from "./stripePayoutReconciliation.js";
import {
  shouldApplyIncompletePaymentStatus,
  validateSucceededRidePaymentIntent,
  type RidePaymentBookingSnapshot,
  type RidePaymentTripSnapshot,
} from "./stripePaymentValidation.js";
import { stripeReport } from "./stripeWebhookReports.js";

type StripeAccountUpdate = {
  id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

export async function reconcileStripeEvent(event: Stripe.Event): Promise<void> {
  const eventRef = firestore.collection("reports").doc(`stripe_${event.id}`);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) return;

  if (event.type === "payment_intent.succeeded") {
    await reconcilePaymentSucceeded(event, eventRef.path);
  } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    await reconcilePaymentIncomplete(event, eventRef.path);
  } else if (event.type === "account.updated") {
    await reconcileAccountUpdated(event, eventRef.path);
  } else if (isTransferEvent(event.type)) {
    await reconcilePayoutTransfer(event, eventRef.path);
  } else {
    await eventRef.set(stripeReport(event));
  }
}

async function reconcilePaymentSucceeded(event: Stripe.Event, eventPath: string): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  if (intent.metadata.product !== "sports-green-moove") {
    await firestore.doc(eventPath).set(stripeReport(event));
    return;
  }

  const bookingId = intent.metadata.bookingId;
  if (!bookingId) {
    await firestore.doc(eventPath).set({ ...stripeReport(event), reconciliationStatus: "missingBookingId" });
    return;
  }

  await firestore.runTransaction(async (transaction) => {
    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) {
      transaction.set(firestore.doc(eventPath), { ...stripeReport(event), reconciliationStatus: "bookingMissing" });
      return;
    }
    const booking = { id: bookingSnap.id, ...bookingSnap.data() } as RidePaymentBookingSnapshot;
    if (!booking.tripId) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: "tripMissing",
        reconciliationReason: "Booking has no tripId.",
      });
      return;
    }

    const tripRef = firestore.collection("trips").doc(booking.tripId);
    const tripSnap = await transaction.get(tripRef);
    if (!tripSnap.exists) {
      transaction.set(firestore.doc(eventPath), { ...stripeReport(event), reconciliationStatus: "tripMissing" });
      return;
    }

    const validation = validateSucceededRidePaymentIntent(
      intent,
      booking,
      { id: tripSnap.id, ...tripSnap.data() } as RidePaymentTripSnapshot,
    );
    if (validation.ok === false) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: validation.reconciliationStatus,
        reconciliationReason: validation.reason,
      });
      return;
    }
    const ledgerEntries = buildRidePaymentLedgerEntries(intent);
    if (ledgerEntries.length !== 2) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: "ledgerMetadataInvalid",
        reconciliationReason: "PaymentIntent metadata cannot produce deterministic ledger entries.",
      });
      return;
    }

    transaction.set(
      bookingRef,
      {
        paymentStatus: "paid",
        amountPaidCents: validation.amountCents,
        paymentIntentId: intent.id,
        paidAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    for (const entry of ledgerEntries) {
      const ledgerId = `${intent.id}_${entry.type}_${entry.userId}`;
      transaction.set(firestore.collection("rewardLedger").doc(ledgerId), {
        ...entry,
        id: ledgerId,
        createdAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      });
    }

    transaction.set(firestore.doc(eventPath), { ...stripeReport(event), reconciliationStatus: "paymentReconciled" });
  });
}

async function reconcilePaymentIncomplete(event: Stripe.Event, eventPath: string): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const bookingId = intent.metadata.bookingId;
  if (intent.metadata.product !== "sports-green-moove" || !bookingId) {
    await firestore.doc(eventPath).set(stripeReport(event));
    return;
  }

  await firestore.runTransaction(async (transaction) => {
    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) {
      transaction.set(firestore.doc(eventPath), { ...stripeReport(event), reconciliationStatus: "bookingMissing" });
      return;
    }

    const validation = shouldApplyIncompletePaymentStatus(
      intent,
      { id: bookingSnap.id, ...bookingSnap.data() } as RidePaymentBookingSnapshot,
    );
    if (validation.ok === false) {
      transaction.set(firestore.doc(eventPath), {
        ...stripeReport(event),
        reconciliationStatus: validation.reconciliationStatus,
        reconciliationReason: validation.reason,
      });
      return;
    }
    transaction.set(
      bookingRef,
      {
        paymentStatus: event.type === "payment_intent.canceled" ? "canceled" : "failed",
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    transaction.set(firestore.doc(eventPath), { ...stripeReport(event), reconciliationStatus: "paymentIncomplete" });
  });
}

async function reconcileAccountUpdated(event: Stripe.Event, eventPath: string): Promise<void> {
  const account = event.data.object as StripeAccountUpdate;
  if (!account.id) {
    await firestore.doc(eventPath).set(stripeReport(event));
    return;
  }

  const snapshot = await firestore.collection("stripeAccounts").where("stripeAccountId", "==", account.id).limit(10).get();
  const batch = firestore.batch();
  for (const doc of snapshot.docs) {
    batch.set(
      doc.ref,
      {
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  }
  batch.set(firestore.doc(eventPath), {
    ...stripeReport(event),
    reconciliationStatus: snapshot.empty ? "accountMissing" : "accountUpdated",
  });
  await batch.commit();
}
