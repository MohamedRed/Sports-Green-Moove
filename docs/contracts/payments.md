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

iOS and Android list approved, unpaid, non-free parent bookings from Firestore
and open PaymentSheet only for those bookings. Requested bookings remain
non-payable until the driver approves them.

`createStripeAccountLink` accepts `returnUrl` and `refreshUrl` for the signed-in
driver. The backend loads `stripeAccounts/{uid}`, calls Accounts v2
`/v2/core/account_links` for `account_onboarding`, and returns the Stripe-hosted
onboarding URL.

Native onboarding requires environment-specific URLs:

- `SGM_STRIPE_CONNECT_RETURN_URL`
- `SGM_STRIPE_CONNECT_REFRESH_URL`

Android injects these as string resources at build time. iOS injects them into
`Info.plist` through XcodeGen and can also read them from the process
environment for Swift package builds. Missing values are configuration errors;
the apps do not invent replacement URLs.

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

On `endRide`, the backend completes the ride and writes deterministic immutable accounting entries in the same Firestore transaction:

- `co2Ledger/rideCompletion_{rideSessionId}` records the driver-owned CO2 saving source data.
- `rewardLedger/co2Bonus_{rideSessionId}_{driverUserId}` records the driver's positive `co2Bonus` when the computed reward is greater than zero.

On `payment_intent.succeeded`, the Stripe webhook marks the booking paid and writes deterministic ledger entries:

- `ridePayment`: negative entry for the parent.
- `driverEarning`: positive entry for the driver, net of platform fee.

Before marking a booking paid, the webhook verifies the PaymentIntent against
the booking and trip documents: booking id, trip id, parent user, driver user,
PaymentIntent id, EUR currency, and server-priced amount must all match.
Mismatches are written to `reports/stripe_{eventId}` and do not update booking
or ledger state.

The platform fee used for ledger math is frozen into PaymentIntent metadata as
`platformFeeCents` when the PaymentIntent is created. Webhook reconciliation
does not recalculate historical fees from current environment variables.

On `payment_intent.payment_failed` or `payment_intent.canceled`, the booking payment status is updated without writing earning ledger entries.
Paid bookings are never downgraded by later incomplete payment events.

`issueRewardPayout` is admin-only. It requires:

- a positive EUR amount.
- a payout-ready `stripeAccounts/{userId}` record with `payoutsEnabled: true`.
- enough immutable `rewardLedger` balance for the requested amount.
- an optional caller-provided `sourceId` for idempotency.

The backend creates a Stripe Transfer to the connected account and writes a
negative `payout` ledger entry using `payout_{userId}_{sourceId}` as the
deterministic document id.

On `transfer.created`, `transfer.updated`, or `transfer.reversed`, the Stripe
webhook verifies the transfer metadata against the deterministic payout ledger
entry and writes an admin-visible `reports/stripe_{eventId}` reconciliation
report. Reversed transfers create a deterministic positive `refund` ledger
entry using `refund_{transferId}_{userId}` so reward balances remain derived
from immutable ledger documents.
