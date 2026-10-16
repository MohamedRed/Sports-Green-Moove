# Applying Confirmed Trip Changes

Implemented locally on 2026-10-16; not deployed to production. This extends the
[parent confirmation contract](trip-editing.md), not the native editing screens.

## Quote And Apply

After every affected parent accepts the exact proposal, the owning driver calls
`getTripChangeApplicationQuote` with its revision and a UUID. The production
adapter requests a route for the proposed origin, destination and future time
using [Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions).
No client-supplied distance or alternate local route is accepted. Provider failure
leaves no saved quote; any source change during the network request aborts it.
Quotes expire after five minutes and require an explicitly new request afterward.

`applyTripChanges` checks the current trip, active reservations, guardian document
versions, unanimous decisions and matching driver-owned server quote in a single
transaction. It writes time, route and price together with route distance/duration,
geohash, impact estimate, booking agreement prices, application receipt and notices.
The [Firebase geohash helper](https://firebase.google.com/docs/firestore/solutions/geoqueries)
recomputes the changed origin's index. A repeated matching application returns its
receipt; a different request cannot apply it again. No parent may apply a change.

Declined, withdrawn, outdated, expired or incompletely accepted proposals never
apply. A booking cancellation or changed guardian record invalidates a quote.
Application does not cancel reservations or reuse consent for different terms.

## Payments Are Separate

`paymentPriceCents` freezes the original provider invoice. `agreedPriceCents` and
`agreedAmountCents` describe the newly accepted booking. A paid booking must have
an exact reconciled original amount; applying a changed price never overwrites
that invoice, payment intent or recorded amount paid.

Application creates server-only `tripChangeBalances` records: `paymentDue` for an
increase, `refundDue` for a decrease, `notRequired` otherwise. These are obligations,
not charges or refunds. An outstanding balance prevents ride start and another
proposal. Unpaid bookings on an edited paid trip must pay before ride start.
Cancellation closes the balance plan; any paid cancellation still records only
`refundStatus: pending`. No refund-issued or settled status is inferred.

Actual collection/refund execution, provider event reconciliation for adjustments,
and the parent payment/refund UI are still unimplemented. Original-payment
reconciliation preserves recorded money and does not settle these new balances.

## Original Payment Preparation

An authorized parent's checkout claims a server-owned UUID attempt transactionally
against the booking and trip. A proposal and payment claim cannot both win. The
claim fixes amount, agreed revision and connected destination before contacting
Stripe. Concurrent preparation reuses that attempt and provider idempotency key;
known legacy intent IDs are retrieved rather than recreated. Amount/owner/attempt
mismatches are rejected. Provider responses cannot reactivate a cancelled booking
or downgrade a paid booking. A late success on a cancelled booking remains a
pending refund, not a reopened reservation.

An unknown attempt older than 23 hours requires explicit provider reconciliation;
the service does not blindly repeat a create request beyond the conservative
retention window. A provider-confirmed cancelled intent can be retired, after
which an explicit checkout request obtains a fresh attempt. See Stripe's
[idempotent request contract](https://docs.stripe.com/api/idempotent_requests)
and [PaymentIntent lifecycle](https://docs.stripe.com/payments/payment-intents).

All quote, balance, application and payment-attempt history collections are
server-only. Ordinary parents, drivers, administrators and signed-out clients
cannot directly read, query, create, modify or delete those records.

## Evidence Boundary

Local transport tests use real authenticated application callables and independent
persisted checks, but inject a synthetic route provider through the service API.
Payment preparation tests call the actual transactional helper against isolated
data with synthetic provider responses/events. They do not prove deployed Maps,
checkout, adjustment collection, refund settlement, native editing, physical
tracking or production readiness. Historical consent-only evidence is unchanged.
