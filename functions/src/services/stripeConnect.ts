import Stripe from "stripe";

const apiVersion = "2026-02-25.clover";

export function createStripeClient(secret = process.env.STRIPE_SECRET_KEY): Stripe {
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe operations");
  }

  return new Stripe(secret, { apiVersion: apiVersion as Stripe.StripeConfig["apiVersion"] });
}

export function stripePublishableKey(key = process.env.STRIPE_PUBLISHABLE_KEY): string {
  if (!key) {
    throw new Error("STRIPE_PUBLISHABLE_KEY is required for native PaymentSheet.");
  }

  return key;
}

export type ConnectedAccountRequest = {
  email: string;
  country: "BE";
  userId: string;
};

export type ConnectedAccountResponse = {
  id: string;
  reused?: boolean;
};

export function connectedAccountFromRecord(record: { stripeAccountId?: unknown } | undefined): ConnectedAccountResponse | null {
  return typeof record?.stripeAccountId === "string" && record.stripeAccountId.length > 0
    ? { id: record.stripeAccountId, reused: true }
    : null;
}

export function buildConnectedAccountCreateParams(
  request: ConnectedAccountRequest,
): Stripe.AccountCreateParams {
  return {
    type: "express",
    country: request.country,
    email: request.email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      userId: request.userId,
      product: "sports-green-moove",
    },
  };
}

export async function createConnectedAccount(
  request: ConnectedAccountRequest,
  secret?: string,
): Promise<ConnectedAccountResponse> {
  const stripe = createStripeClient(secret);
  const account = await stripe.accounts.create(buildConnectedAccountCreateParams(request), {
    idempotencyKey: `connectedAccount:${request.userId}`,
  });

  return { id: account.id };
}

export type ConnectedAccountLinkRequest = {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
};

export function buildConnectedAccountLinkCreateParams(
  request: ConnectedAccountLinkRequest,
): Stripe.AccountLinkCreateParams {
  return {
    account: request.accountId,
    refresh_url: request.refreshUrl,
    return_url: request.returnUrl,
    type: "account_onboarding",
  };
}

export async function createConnectedAccountLink(
  request: ConnectedAccountLinkRequest,
  secret?: string,
): Promise<{ url: string; expiresAt?: string }> {
  const stripe = createStripeClient(secret);
  const link = await stripe.accountLinks.create(buildConnectedAccountLinkCreateParams(request));
  return { url: link.url, expiresAt: link.expires_at ? String(link.expires_at) : undefined };
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
        platformFeeCents: String(applicationFeeAmount),
        product: "sports-green-moove",
      },
    },
  };
}

export async function createRideDestinationPaymentIntent(
  context: RidePaymentIntentContext,
  secret?: string,
): Promise<Stripe.PaymentIntent> {
  const stripe = createStripeClient(secret);
  const request = buildRidePaymentIntentCreateParams(context);
  return stripe.paymentIntents.create(request.params, { idempotencyKey: request.idempotencyKey });
}

export type RewardPayoutTransferContext = {
  userId: string;
  amountCents: number;
  currency: "eur";
  destinationStripeAccountId: string;
  sourceId: string;
};

export function buildRewardPayoutTransferCreateParams(context: RewardPayoutTransferContext): {
  params: Stripe.TransferCreateParams;
  idempotencyKey: string;
} {
  return {
    idempotencyKey: `rewardPayout:${context.userId}:${context.sourceId}`,
    params: {
      amount: context.amountCents,
      currency: context.currency,
      destination: context.destinationStripeAccountId,
      metadata: {
        userId: context.userId,
        sourceId: context.sourceId,
        product: "sports-green-moove",
      },
    },
  };
}

export async function createRewardPayoutTransfer(
  context: RewardPayoutTransferContext,
  secret?: string,
): Promise<Stripe.Transfer> {
  const stripe = createStripeClient(secret);
  const request = buildRewardPayoutTransferCreateParams(context);
  return stripe.transfers.create(request.params, { idempotencyKey: request.idempotencyKey });
}
