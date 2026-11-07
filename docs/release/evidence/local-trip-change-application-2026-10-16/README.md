# Confirmed Trip Application And Original Payment Fencing

Local verification: **2026-10-16T20:29:04.849Z**. Run:
`b1eb4082f0c9bad923b854ee0dc28c20`, isolated `demo-sgm-local-qa`.
These changes are **not deployed to production**.

## Completed Checks

- **23/23 service groups** passed, including retained consent, cancellation,
  booking, ride, membership and messaging checks plus trip-change application.
- **172/172 unit cases** passed, including invoice/amount/attempt contracts and
  the route-provider transport test.
- **162/162 security-rule cases** passed. Parents, drivers, administrators and
  signed-out clients cannot directly read/query/create/update/delete proposals,
  route quotes, balance plans or payment-attempt history (80 denial cases).
- **58/58 isolation checks**, **5/5 response-loss checks** passed separately.

Actual authenticated local application calls update confirmed time, origin and
price together. Independent saved-state checks verify the receipt, one notice
per recipient, new booking agreement revision, 12 km route, 900 second duration,
recomputed geohash and 6.4 kg estimated impact. Repeated identical calls return
one receipt; competing application identities have one winner. Parents, another
driver and signed-out callers cannot apply. Missing/expired/stale quotes, changed
guardian records, cancellation during calculation and provider failure leave no
application. Provider failure/source changes also leave no new saved quote.

Synthetic paid fixtures start at 250 cents. Confirmed prices of 400 and 100 cents
retain the original 250-cent invoice and record +150 `paymentDue` / -150 `refundDue`
plans. Neither plan permits ride start or another proposal. A delayed synthetic
original-payment success still reconciles its original invoice and does not clear
the new balance. Parent/trip cancellation closes the plan; refunds remain pending.
An unpaid edited 400-cent booking cannot start and prepares an exact 400-cent
original-payment invoice.

Direct calls to the actual payment-preparation service against isolated data
verify one attempt for concurrent preparation, immutable amount/owner binding,
foreign-attempt event rejection, known intent reuse, no paid-state downgrade,
no cancelled-booking reactivation, late-success pending refund, explicitly fresh
checkout after provider cancellation, aged unknown attempt rejection, and one
winner between checkout preparation and a trip proposal.

## Scope And Remaining Work

Route quotes use an **explicitly injected synthetic provider** through the service
API. Payment preparation uses **synthetic provider responses**; webhook events
are synthetic and sent to the actual isolated reconciliation service. The provider
quote adapter has unit transport coverage, not a live Maps request in this run.
No production fake-provider fallback was added. This is **not a real payment**.

Actual balance collection, refund execution/reconciliation, native editing and
parent-review/payment screens remain unfinished. No live provider result,
refund-issued status, new screenshot or video, physical GPS/tracking, background
execution, push delivery or production readiness is claimed. Older cancellation
captures remain dated and unchanged; they are not pictures of the new application
flow. The full user-flow/release goal remains open.

The initial separate response-loss test invocation overlapped this service run
and failed two cases with `EADDRINUSE` on port 5001. The server suites were allowed
to finish; rerunning those five tests after shutdown passed. This was a test-port
conflict, not accepted evidence of a product success or a product fix.

Raw `services.json`, `unit.json`, `rules.json` are retained byte-for-byte with
SHA-256 checksums in `artifact-sha256.json`. Historical consent-only reports are
not rewritten. Current contract: `docs/contracts/trip-change-application.md`.
