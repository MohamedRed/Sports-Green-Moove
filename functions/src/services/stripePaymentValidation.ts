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

export function validateSucceededRidePaymentIntent(
  intent: Stripe.PaymentIntent,
  booking: RidePaymentBookingSnapshot,
  trip: RidePaymentTripSnapshot,
): RidePaymentValidationResult {
  const parentUserId = booking.parentUserId ?? booking.requesterUserId;
  const expectedAmount = (trip.priceCents ?? 0) * (booking.seats ?? 1);

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
  if (intent.currency !== "eur") {
    return rejected("currencyMismatch", "PaymentIntent currency must be EUR.");
  }
  if (expectedAmount <= 0 || intent.amount !== expectedAmount) {
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

  return { ok: true, amountCents: intent.amount, parentUserId: booking.parentUserId ?? booking.requesterUserId ?? "" };
}

function rejected(reconciliationStatus: string, reason: string): RidePaymentValidationResult {
  return { ok: false, reconciliationStatus, reason };
}
