import type Stripe from "stripe";

export type RidePaymentBookingSnapshot = {
  id: string;
  tripId?: string;
  parentUserId?: string;
  requesterUserId?: string;
  driverUserId?: string;
  seats?: number;
  paymentIntentId?: string;
  paymentStatus?: string;
  status?: string;
  refundStatus?: string;
  paymentPriceCents?: number;
  amountPaidCents?: number;
  paymentAttempt?: { id: string; intentId?: string };
};

export type RidePaymentTripSnapshot = {
  id: string;
  priceCents?: number;
};

export type RidePaymentValidationResult =
  | {
      ok: true;
      amountCents: number;
      parentUserId: string;
    }
  | {
      ok: false;
      reconciliationStatus: string;
      reason: string;
    };

export function ridePaymentAmountCents(
  booking: RidePaymentBookingSnapshot,
  trip: RidePaymentTripSnapshot,
): number | null {
  const priceCents = booking.paymentPriceCents === undefined ? trip.priceCents : booking.paymentPriceCents;
  const seats = booking.seats ?? 1;
  if (typeof priceCents !== "number" || !Number.isSafeInteger(priceCents) || priceCents <= 0) return null;
  if (typeof seats !== "number" || !Number.isSafeInteger(seats) || seats <= 0) return null;

  const amountCents = priceCents * seats;
  return Number.isSafeInteger(amountCents) && amountCents > 0 ? amountCents : null;
}

export function validateSucceededRidePaymentIntent(
  intent: Stripe.PaymentIntent,
  booking: RidePaymentBookingSnapshot,
  trip: RidePaymentTripSnapshot,
): RidePaymentValidationResult {
  const parentUserId = booking.parentUserId ?? booking.requesterUserId;
  const expectedAmount = ridePaymentAmountCents(booking, trip);

  if (intent.metadata.product !== "sports-green-moove") {
    return rejected("ignoredProduct", "PaymentIntent product metadata does not belong to Sports Green-mOOVe.");
  }
  if (intent.metadata.bookingId !== booking.id) {
    return rejected("bookingMismatch", "PaymentIntent booking metadata does not match the booking document.");
  }
  if (intent.metadata.tripId !== booking.tripId || intent.metadata.tripId !== trip.id) {
    return rejected("tripMismatch", "PaymentIntent trip metadata does not match booking/trip documents.");
  }
  if (!parentUserId || intent.metadata.payerUserId !== parentUserId) {
    return rejected("payerMismatch", "PaymentIntent payer metadata does not match the booking parent.");
  }
  if (!booking.driverUserId || intent.metadata.driverUserId !== booking.driverUserId) {
    return rejected("driverMismatch", "PaymentIntent driver metadata does not match the booking driver.");
  }
  if (booking.paymentIntentId && booking.paymentIntentId !== intent.id) {
    return rejected("paymentIntentMismatch", "PaymentIntent id does not match the booking paymentIntentId.");
  }
  if (!matchesPaymentAttempt(intent, booking)) {
    return rejected("paymentAttemptMismatch", "PaymentIntent does not belong to the active server payment attempt.");
  }
  if (intent.currency !== "eur") {
    return rejected("currencyMismatch", "PaymentIntent currency must be EUR.");
  }
  if (expectedAmount == null || intent.amount !== expectedAmount) {
    return rejected("amountMismatch", "PaymentIntent amount does not match server-priced booking amount.");
  }

  return { ok: true, amountCents: expectedAmount, parentUserId };
}

export function shouldApplyIncompletePaymentStatus(
  intent: Stripe.PaymentIntent,
  booking: RidePaymentBookingSnapshot,
): RidePaymentValidationResult {
  if (intent.metadata.product !== "sports-green-moove") {
    return rejected("ignoredProduct", "PaymentIntent product metadata does not belong to Sports Green-mOOVe.");
  }
  if (intent.metadata.bookingId !== booking.id) {
    return rejected("bookingMismatch", "PaymentIntent booking metadata does not match the booking document.");
  }
  if (booking.paymentStatus === "paid") {
    return rejected("paidBookingUnchanged", "Paid bookings are not downgraded by incomplete payment events.");
  }
  if (booking.paymentIntentId && booking.paymentIntentId !== intent.id) {
    return rejected("paymentIntentMismatch", "PaymentIntent id does not match the booking paymentIntentId.");
  }
  if (!matchesPaymentAttempt(intent, booking)) {
    return rejected("paymentAttemptMismatch", "PaymentIntent does not belong to the active server payment attempt.");
  }

  return { ok: true, amountCents: intent.amount, parentUserId: booking.parentUserId ?? booking.requesterUserId ?? "" };
}

function matchesPaymentAttempt(intent: Stripe.PaymentIntent, booking: RidePaymentBookingSnapshot): boolean {
  if (!booking.paymentAttempt) return true;
  return typeof booking.paymentAttempt.id === "string" && booking.paymentAttempt.id.length > 0 &&
    (booking.paymentAttempt.intentId === intent.id || booking.paymentIntentId === intent.id || intent.metadata.paymentAttemptId === booking.paymentAttempt.id);
}

function rejected(reconciliationStatus: string, reason: string): RidePaymentValidationResult {
  return { ok: false, reconciliationStatus, reason };
}
