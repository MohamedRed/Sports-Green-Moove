# Payments And Rewards

## Stripe Connect

- Use Stripe Connect Accounts v2.
- Drivers receiving payouts must complete onboarding before paid rides can settle.
- Parent payments use PaymentIntents and native PaymentSheet.
- Destination charges are used for platform-mediated rides.
- Platform fee is `0` by default until business rules are finalized.

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

