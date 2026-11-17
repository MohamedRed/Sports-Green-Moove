# Reward Payout Safety

`issueRewardPayout` requires an authenticated administrator, positive safe-integer
EUR cents, a recipient UID and a caller-persisted `sourceId`. There is no generated
server-side retry identity. The management browser saves that identity and its
amount before calling; an explicit retry after reload uses those frozen terms.
Unavailable or corrupt browser storage blocks sending, without a memory fallback.

## Reservation And Settlement

Before contacting the payment provider, a Firestore transaction reserves the
available balance in `rewardPayoutOperations`. Available money is the complete
recipient ledger minus all unresolved reservations. A shared per-user
`rewardPayoutGuards` document serializes distinct requests, including the first
two requests against an empty operation collection. Completed operations must
still match their immutable posted debit. Malformed accounting fails closed.

The operation freezes recipient, amount, currency, destination, request identity,
creation time and author. Reusing an identity with different terms is refused.
The provider idempotency key remains `rewardPayout:<userId>:<sourceId>`; all provider
parameters are derived from the frozen operation. A completed replay returns the
same receipt without calling the provider or rewriting the ledger. Existing
historical posted payouts are recognized, not resent.

A failure or unknown response leaves the reservation intact. No failure releases
money or automatically creates another request. An unresolved operation older
than 23 hours is not resent: provider idempotency keys can expire after 24 hours.
It requires provider reconciliation, not a new identity or manual deletion.

Both the provider response and a signature-verified transfer webhook can settle
the reservation. Identity, destination, amount and currency must match. Settlement
posts one immutable debit and completes the operation atomically. An early webhook
therefore works before the callable receives its response. Invalid provider data
does not settle or release the reservation. Normal database failures propagate for
webhook retry; financial mismatches create an explicit reconciliation report.
Confirmation means the connected-account transfer is recorded, not that a bank
payout has settled or funds have reached a bank account.

## Reversals

`amount_reversed` is cumulative, not the amount of the newest reversal. Only the
positive difference from already credited refunds is added. `payoutReversals`
serializes concurrent events, validates the existing credits and preserves the
greatest reconciled cumulative amount. Repeated and older events never remove or
duplicate credit. Each delta is a new immutable ledger entry. The first refund
keeps the historical `refund_<transferId>_<userId>` identity; existing valid legacy
credits are counted without rewriting them. Invalid totals, money or ownership
produce a reconciliation report rather than changing historical entries.

All three new collections are server-owned and covered by the existing default
client deny rule. Queries use automatic single-field indexes; there are no
infrastructure or Terraform changes. The existing backend and web smoke command
now executes the isolated financial regression and management-journal suites.

## Verification Boundary

The retained 23 October run uses a real local Firestore emulator and a simulated
transfer adapter. Browser checks exercise the actual management component with a
separately simulated gateway, at 1440, 768, 390 and 320 pixels. They are not an
integrated browser/payment test, production deployment, bank transfer, native
payment screen, physical-phone payment or release acceptance.

Provider contracts: [idempotent requests](https://docs.stripe.com/api/idempotent_requests)
and [partial transfer reversals](https://docs.stripe.com/api/transfer_reversals/create).
