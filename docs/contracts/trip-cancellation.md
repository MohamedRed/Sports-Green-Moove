# Driver Trip Cancellation

## Scope

The callable service supports cancellation of a published/full trip by its own
driver, or by an explicitly authorized administrator. It does not cancel active
rides. The Android confirmation screen and replay remain outstanding; exporting
the service is not proof that a user can perform this flow in the app.

`getTripCancellation({ tripId })` returns `ready`, a revision, the number of
requested/approved reservations and the number already paid. A cancelled trip
returns its durable receipt. Missing/inconsistent receipts require repair; no
receipt is invented from a cancelled status alone.

`cancelTrip({ tripId, expectedRevision, requestId, reason })` requires the exact
reviewed revision, a UUID and a trimmed 5-300 character reason. The revision
includes trip and active-reservation document update times, including new
requests, approvals and payment changes. A stale confirmation is rejected with
`aborted`, not silently applied to a different set of reservations.

## Atomic Outcome

The same transaction closes all requested/approved reservations, marks the trip
cancelled, releases only seats held by approved reservations, writes a
`tripCancellations/{tripId}` receipt and creates one stored notice per distinct
parent. Previously declined/cancelled/completed reservations are unchanged.
Capacity initially withheld by a driver is not made newly available.

The transaction checks both the active-ride pointer and an active-ride query.
Malformed seat/owner metadata and excess held seats fail before any mutation.
A maximum of 100 active reservations keeps the operation within a bounded
transaction (at most 202 writes). At 101 it returns `resource-exhausted` with no
partial changes. A larger trip requires explicit reconciliation, not truncation.

A repeat with the same actor, UUID, reason and expected revision returns the
original receipt. Another intent cannot overwrite it. Receipt storage and trip
cancellation fields cannot be forged by a direct driver write. Existing title
editing and administrator policy remain unchanged.

## Payments And Notifications

Paid reservations use the existing `refundStatus: pending` policy. No refund is
issued here and no completed-refund claim is made. Validated success events that
arrive after a reservation was cancelled also mark its refund pending, without
reopening the reservation. A previously recorded terminal refund state is not
reset by a later success event. Payment/cancellation ordering is tested with
synthetic local events only, not real charges or refunds.

The receipt records counts at cancellation time, not a live refund total. Late
payment changes are reflected in reservation state, not by rewriting history.
Notices are stored atomically and exposed in the parent's inbox. Push delivery
and actual settlement remain separate release requirements. Existing payment
intent creation/provider races and settlement must be verified before paid
cancellation can be considered release-ready.

## Verification

`npm run test:local-flows` includes authenticated HTTP calls, independent saved
state checks, duplicate/concurrent cancellation, stale confirmations, foreign
actors, active/orphan rides, the 100/101 bound, and races against requesting,
approving and starting. `test:rules` covers direct-write denial.
`test:stripe-webhook-flow` covers payment-first, cancellation-first and concurrent
synthetic reconciliation. These do not replace a native app replay, physical
devices, live refund evidence or production deployment.
