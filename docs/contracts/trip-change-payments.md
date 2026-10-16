# Trip Change Supplements And Payment Receipts

This extends [confirmed trip application](trip-change-application.md). It does not
complete the editing screens, refunds or live-provider verification.

## Separate Checkout

`createTripChangePaymentIntent` is parent-only. Its service transaction verifies
the owning booking, applied agreement, positive balance, recorded amount paid,
driver and available trip. It requires immutable successful payment receipts whose
net total exactly matches recorded money. Missing, reserved or inconsistent
receipts require reconciliation; no synthetic paid flag or recreated legacy
invoice substitutes for them. A legacy receipt import/reconciliation tool is not
implemented yet.

The claim stores one UUID attempt with its amount, fee and destination before
network access. Concurrent preparation reuses it. The provider key and metadata
bind the balance, booking, payer, driver and attempt. Fees remain frozen across a
lost reply or configuration change. A known intent is
[retrieved](https://docs.stripe.com/api/payment_intents/retrieve), not recreated.
Unknown attempts older than 23 hours require provider reconciliation. Only a
provider-confirmed cancelled intent permits a fresh, explicit checkout attempt.

Provider responses are checked against the prepared request **before** any
reconciliation, including a response that happens to be another valid invoice.
Pending/incomplete responses do not change money or clear the obligation. An
incomplete checkout without a usable client secret remains recoverable through
the same known intent; no replacement charge is created.

## Confirmed Money

The callback and webhook share one transactional reconciliation path. Only
`succeeded` records a supplement receipt, adds its amount to recorded money,
settles the active balance and creates the deterministic payer/driver ledger pair.
The original payment intent and unit-price invoice remain untouched. Multiple
increases create separate receipts; late original events cannot reset the total.
Duplicate events and callback/webhook races cannot credit the supplement twice.
Later incomplete events cannot downgrade a successful receipt.

Successful original payments now also create immutable `ridePaymentReceipts` and
preserve existing ledger rows. A conflicting receipt or ledger is reported for
reconciliation instead of being overwritten. Records exclude client secrets.
Parents, drivers, administrators and signed-out clients cannot directly access
these private collections. `getTripChangePaymentStatus` exposes only the owning
parent's amount, obligation and status, without account/checkout secrets.

If cancellation wins during preparation, no usable checkout is returned and the
booking stays closed. A later confirmed supplement still records real incoming
money exactly once, leaves the closed balance cancelled, and marks a pending
refund. This is not a claim that the refund was executed.

## Still Required

Actual decrease/cancellation refund execution and reconciliation are not
implemented. Refund allocation must use all successful invoices, not only the
original intent: two supplements may make an owed refund larger than any one
charge. Stripe permits partial refunds only up to the remaining refundable amount
of that charge, with destination-transfer/application-fee behavior accounted for
separately. See the [refund API](https://docs.stripe.com/api/refunds/create).

The native editor, parent review and supplement checkout/status screens, legacy
receipt reconciliation, physical-device behavior, provider failures, actual charge
and refund evidence remain open. Local tests inject an explicit synthetic provider
into the actual service; production uses the Stripe adapter. No production fake
provider, automatic financial fallback, provider call or deployment is introduced
by those tests.
