# Payments And Rewards

## Stripe Connect

- Use Stripe Connect Accounts v2.
- Drivers receiving payouts must complete onboarding before paid rides can settle.
- Parent payments use PaymentIntents and native PaymentSheet.
- Destination charges are used for platform-mediated rides.
- Platform fee is `0` by default until business rules are finalized.

`createRidePaymentIntent` accepts a `bookingId` and derives all money-sensitive fields server-side:

- the caller must be the booking parent.
- the booking must be approved.
- the amount is `trip.priceCents * booking.seats`.
- the destination account comes from `stripeAccounts/{driverUserId}`.
- client-supplied amounts or destination accounts are not accepted.
- `STRIPE_PUBLISHABLE_KEY` must be configured before the backend creates the PaymentIntent.

The callable returns the native PaymentSheet setup data:

- `bookingId`
- `paymentIntentId`
- `clientSecret`
- `publishableKey`
- `amountCents`
- `currency`

iOS and Android request this config by `bookingId`, initialize the Stripe SDK with the returned publishable key, and present native PaymentSheet with the returned PaymentIntent client secret.

Android lists approved, unpaid, non-free parent bookings from Firestore and opens
PaymentSheet only for those bookings. Requested bookings remain non-payable until
the driver approves them.

`createStripeAccountLink` accepts `returnUrl` and `refreshUrl` for the signed-in
driver. The backend loads `stripeAccounts/{uid}`, calls Accounts v2
`/v2/core/account_links` for `account_onboarding`, and returns the Stripe-hosted
onboarding URL.

## Ledgers

`rewardLedger` is immutable. Balances are computed from ledger entries, not overwritten fields.

Ledger entry types:

- `ridePayment`
- `driverEarning`
- `co2Bonus`
- `referralBonus`
- `manualAdjustment`
- `payout`
- `refund`

The app does not represent rewards as stored value money. It shows an app ledger reconciled against Stripe events.

On `payment_intent.succeeded`, the Stripe webhook marks the booking paid and writes deterministic ledger entries:

- `ridePayment`: negative entry for the parent.
- `driverEarning`: positive entry for the driver, net of platform fee.

On `payment_intent.payment_failed` or `payment_intent.canceled`, the booking payment status is updated without writing earning ledger entries.

`issueRewardPayout` is admin-only. It requires:

- a positive EUR amount.
- a payout-ready `stripeAccounts/{userId}` record with `payoutsEnabled: true`.
- enough immutable `rewardLedger` balance for the requested amount.
- an optional caller-provided `sourceId` for idempotency.

The backend creates a Stripe Transfer to the connected account and writes a
negative `payout` ledger entry using `payout_{userId}_{sourceId}` as the
deterministic document id.
