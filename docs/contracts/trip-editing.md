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

## Approved Parent Confirmation

On 2026-10-16 the owner explicitly selected **fresh parent confirmation** for
changes to the time, route or price after reservations. Cancellation followed by
a newly published trip is not the selected editing policy. The full editing flow
is still not implemented.

Old consent must not stand for agreement to new details. Do not cancel
reservations automatically or publish a title-only screen as the completed editor.
The proposed details and each affected parent's explicit decision must remain
bound to the same authoritative revision. An unanswered or stale decision must
not authorize changed details, a changed payment amount or a ride start.

Required work remains: the complete server change contract, authoritative
revision and repeat/unknown-outcome handling, affected reservation/payment/consent
behavior, recipient notices, a real native editing and parent-review screen, and
end-to-end approval/denial/race/recovery tests under the chosen policy.

## Required Editing Verification

- A driver proposes changed time, route or price; the parent sees original and
  proposed details before explicitly deciding. Existing consent is not reused.
- Only affected parents can decide for their own reservations. Another parent,
  an outsider or the driver cannot supply acceptance on their behalf.
- Parent decisions reference the exact proposal revision. A later proposal,
  changed reservation or delayed response cannot silently reuse earlier consent.
- Pending, accepted and declined decisions are independently verified against
  persisted trip, booking, consent and notification records. No response is not
  acceptance. Repeated requests do not duplicate notices or charges.
- Changes remain distinct from current confirmed details until the required
  confirmations are complete. A ride cannot start using unconfirmed conditions.
- Request, approval, cancellation, ride start, payment initiation and payment
  webhook races cannot bypass confirmation or reprice an already paid booking.
- Paid price increases/decreases require explicit amount/currency reconciliation
  and corresponding payment/refund evidence; no automatic extra charge or
  claimed refund may be inferred from a confirmation or a synthetic paid flag.
- Screen rotation, account switching, disconnection, response loss, process
  restart and lists with multiple parents/reservations preserve the correct
  proposal and decisions without exposing another account's data.

Declined, withdrawn, expired and partially confirmed proposals need an explicit
server contract before implementation. Do not silently convert a declined change
into a cancellation or a new booking. The current local boundary fix is not a
substitute for this complete flow.

## Verification Scope

The local regression tests first reproduce direct operational edits on a booked
trip under the original rules, then require denial and unchanged saved trip and
booking data after the fix. The signed-in transport replay seeds simulated paid
metadata only; no charge, refund, real user, physical phone or production resource
is involved. This is write-boundary evidence, not a completed trip-editing flow
and not evidence of real payment settlement or production deployment.

The retained 18:48 local report predates the owner's confirmation decision. Its
`reconfirmationPolicyApproved: false` records that original checkpoint and must
not be rewritten to look like a later editing-flow execution.
