# Trip Editing

## Existing Write Boundary

An ordinary client may update only the existing cosmetic `title` field on its
own trip. That legacy policy is preserved; this change does not add a title editor
or broaden the title policy. Other users and signed-out visitors cannot edit it.
Explicit administrator capabilities keep their prior policy.

All other trip fields are server-managed for ordinary clients. An allowlist,
rather than a list of currently known protected fields, prevents newly introduced
fields from becoming writable accidentally. This includes price, route, dates,
club/team/category, baggage/return-trip conditions, tracking support, estimates,
participant/access hints, timestamps, capacity, lifecycle and future edit state.
Field removal, document replacement and atomic commits cannot bypass the boundary.
A title bundled with an operational change is denied as a whole.

Published-trip creation, booking decisions, cancellation, ride lifecycle and
server-side reconciliation remain separate authorized operations. Current native
clients use callables for those mutations; the management trip table is read-only.
The legacy direct title update and explicit administrator path remain covered by
positive tests, not just denial tests.

## Required Product Decision

The full editing flow is not implemented. On 2026-10-16 the owner was asked whether
a change to time, route or price after reservations requires fresh parent
confirmation, or cancellation followed by a newly published trip. No response has
been received at this checkpoint. A preselected option is not approval.

Do not silently choose either behavior, cancel reservations automatically, treat
old consent as agreement to a new route/price, or publish a title-only screen as
the completed editing flow. Required work remains: the complete server change
contract, authoritative revision and repeat/unknown-outcome handling, affected
reservation/payment/consent behavior, recipient notices, a real native editing
screen, and end-to-end approval/denial/race/recovery tests under the chosen policy.

## Verification Scope

The local regression tests first reproduce direct operational edits on a booked
trip under the original rules, then require denial and unchanged saved trip and
booking data after the fix. The signed-in transport replay seeds simulated paid
metadata only; no charge, refund, real user, physical phone or production resource
is involved. This is write-boundary evidence, not a completed trip-editing flow
and not evidence of real payment settlement or production deployment.
