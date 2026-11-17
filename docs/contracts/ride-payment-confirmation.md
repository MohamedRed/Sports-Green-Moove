# Ride Payment Confirmation

Checkout completion and application reconciliation are separate states. Native
apps show `Paiement confirmé.` only after `getRidePaymentStatus` reports
`recorded` for the exact parent, booking and prepared PaymentIntent. Closing the
checkout window is not a server cancellation.

The callable requires a signed-in parent and the owning booking parent, validates
document IDs and rejects extra input. A read-only transaction joins the booking,
original immutable receipt, parent payment ledger and driver earning ledger.
Amounts use the original frozen invoice, not a later trip price. Missing,
inconsistent, unrelated or refund-affected records return `review`; they are never
repaired or paid from this read. Responses contain only booking ID, intent ID and
state. No provider API, secret, charge, refund or mutation is involved.

Both apps bind the prepared configuration to the displayed booking and amount,
keep delayed/failed reads pending, and expose a separate read-only verification
action. Repeated taps do not prepare another checkout while this verification is
pending. Account changes ignore late checkout and status responses. A confirmed
record remains confirmed if refreshing the rest of the screen fails.

## Rollout And Remaining Scope

Deploy the new callable before distributing clients that use it. This contract
does not establish a production deployment or live provider outcome.

The checkout SDK and webhook are simulated in component/service tests. These do
not establish real checkout, 3-D Secure, provider cancellation, payments during
process death, refunds, supplement checkout UI, payouts or physical-device
payment readiness. The pending native target is in memory; process-death
recovery still needs implementation/verification. Existing server-owned payment
attempt idempotency remains unchanged. No payment credentials are persisted.

An unresolved payment currently holds new checkout preparation until the saved
record can be verified. Refund/review resolution and the wider payment history
remain separate unfinished work, not a successful payment outcome.
