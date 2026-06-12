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
