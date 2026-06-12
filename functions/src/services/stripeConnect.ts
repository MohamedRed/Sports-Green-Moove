import Stripe from "stripe";

const apiVersion = "2026-02-25.clover";

export function createStripeClient(secret = process.env.STRIPE_SECRET_KEY): Stripe {
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe operations");
  }

  return new Stripe(secret, { apiVersion: apiVersion as Stripe.StripeConfig["apiVersion"] });
}

export type ConnectedAccountRequest = {
  email: string;
  country: "BE";
  userId: string;
};

export async function createConnectedAccount(request: ConnectedAccountRequest): Promise<{ id: string }> {
  const stripe = createStripeClient();
  const response = await stripe.rawRequest("POST", "/v2/core/accounts", {
    contact_email: request.email,
    identity: {
      country: request.country,
      entity_type: "individual",
    },
    metadata: {
      userId: request.userId,
      product: "sports-green-moove",
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
    },
  });

  const account = response as unknown as { id: string };
  return { id: account.id };
}

export function platformFeeAmountCents(amountCents: number): number {
  const bps = Number(process.env.PLATFORM_FEE_BPS ?? "0");
  return Math.max(0, Math.round((amountCents * bps) / 10000));
}

export type RidePaymentIntentContext = {
  bookingId: string;
  tripId: string;
  payerUserId: string;
  driverUserId: string;
  amountCents: number;
  currency: "eur";
  destinationStripeAccountId: string;
};

export function buildRidePaymentIntentCreateParams(context: RidePaymentIntentContext): {
  params: Stripe.PaymentIntentCreateParams;
  idempotencyKey: string;
} {
  const applicationFeeAmount = platformFeeAmountCents(context.amountCents);
  return {
    idempotencyKey: `ridePayment:${context.bookingId}:${context.payerUserId}`,
    params: {
      amount: context.amountCents,
      currency: context.currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFeeAmount > 0 ? applicationFeeAmount : undefined,
      transfer_data: { destination: context.destinationStripeAccountId },
      metadata: {
        bookingId: context.bookingId,
        tripId: context.tripId,
        payerUserId: context.payerUserId,
        driverUserId: context.driverUserId,
        product: "sports-green-moove",
      },
    },
  };
}

export async function createRideDestinationPaymentIntent(context: RidePaymentIntentContext): Promise<Stripe.PaymentIntent> {
  const stripe = createStripeClient();
  const request = buildRidePaymentIntentCreateParams(context);
  return stripe.paymentIntents.create(request.params, { idempotencyKey: request.idempotencyKey });
}
