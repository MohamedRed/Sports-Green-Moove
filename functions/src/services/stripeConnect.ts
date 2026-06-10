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
