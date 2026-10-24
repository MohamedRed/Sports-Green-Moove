# Local Trip Supplement And Immutable Payment Receipts

Verified **2026-10-16T21:04:23.187Z**. Isolated `demo-sgm-local-qa` run
`9e0b39d7cfd39ef1e1998b4370f9fc34`. **Not deployed to production**.

## Results

- **24/24 service groups** passed, including the new supplement scenario and
  retained trip application, cancellation, booking, ride, membership and chat cases.
- **189/189 unit cases** passed, including supplement identity, fee/destination,
  original invoice and invalid financial metadata contracts.
- **182/182 security-rule cases** passed, including 100 direct-access denial cases
  across proposals, route quotes, balances, attempt histories and payment receipts.
- **14/14 payment-event cases** passed, including immutable receipt/ledger history
  and rejection of corrupt money without overwriting it.
- **58/58 isolation** and **5/5 bounded response-loss** checks passed separately.

## Actual Service Behavior, Synthetic Provider

The scenario uses the actual original-payment preparation, reconciliation,
proposal, parent acceptance, application, supplement preparation and settlement
transactions. Creation, booking, consent, application, payment-status access and
start use authenticated local callables. Checkout creation/retrieval uses the
actual payment service with an explicitly injected **synthetic provider**; synthetic
events enter the actual reconciliation path. There is no production fake provider.

A reconciled 250-cent original payment is followed by two separately accepted
150-cent supplements. Saved money becomes 550 cents with three immutable receipts.
The first settlement has exactly four payer/driver ledger rows. The original
payment ID, invoice, receipt and historical ledger are retained. The settled
balance permits ride start; pending money does not.

Concurrent calls create one synthetic intent. Callback/webhook races, duplicate
successes, later incomplete events and a delayed original event cannot double
credit or reset paid money. Wrong amount, currency, fee, attempt or destination
does not settle. A different valid provider invoice is rejected before it can
settle another balance. Lost replies reuse the same key, intent and frozen fee.
A provider-confirmed cancellation permits an explicit new attempt; a failed
payment reuses its known intent. An incomplete client secret recovers through
retrieval, not replacement. An unknown aged claim blocks for reconciliation.
Missing or reserved original receipts also prevent supplement claims.

The fee fixture verifies a 150-cent supplement with a 75-cent fee produces the
matching 75-cent driver credit. This is controlled arithmetic/provider-response
evidence, not a live fee, charge, transfer or payout.

When cancellation wins during checkout, no usable checkout is returned. A late
synthetic success adds its receipt/money exactly once, keeps the booking closed
and marks a **pending refund**, not an issued refund.

## Retained Failure And Scope

The first full service attempt passed the new supplement scenario but failed
the retained approval/cancellation race: the test database returned
`INVALID_ARGUMENT: Transaction is invalid or closed`, exposed as `INTERNAL`.
Its exact `services-attempt-one.json` is retained. The accepted final run passed
the unchanged allowed race outcomes. Only the diagnostic message was improved;
no `INTERNAL` acceptance, operation retry or success substitution was added.
The underlying intermittent transaction closure is **not claimed fixed** and
remains a release risk requiring investigation. A later pass is not its explanation.

The first unit invocation could not collect the new test because a parameter
builder imported database initialization. The pure parameter module was separated
from the provider/runtime module; the complete new unit suite then passed.

This is **not a real payment**. No checkout/editing app screen, actual provider,
physical phone, background tracking, push, refund settlement or live deployment
is accepted. Actual refund execution/reconciliation, native editing/review/payment
screens and legacy payment-receipt reconciliation remain unfinished. The older
11 October empty-payment capture is retained with its original date; no new
screenshot/video of a real transaction is fabricated.

Five original JSON reports are preserved byte-for-byte with SHA-256 hashes:
successful/failed service runs, unit, rules and payment events. See
`docs/contracts/trip-change-payments.md` for the implemented contract and remaining
work. The full release/user-flow goal remains active.
