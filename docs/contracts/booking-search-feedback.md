# Booking Feedback In Android Search

The Android search controller now owns per-result sending, retry and confirmation
feedback. Repeated taps are rejected while a request is pending. Once the current
search receives a successful booking acknowledgement, that result shows
`Demande envoyée.` instead of another request button. A stale callback for that
confirmed result cannot submit again. A failed acknowledgement keeps the explicit
retry action for an unconfirmed reply, which uses the existing durable booking
request identity. Definitive business rejections are not labelled as an
unconfirmed-reply retry.

Transient callable failures (`UNAVAILABLE`, `DEADLINE_EXCEEDED`, `INTERNAL`,
`UNKNOWN`, `CANCELLED`) are described as unconfirmed booking replies, not as proof
that the server rejected the booking. Provider details are not exposed. An
`ABORTED` displayed-terms conflict retains its separate new-search requirement;
definitive authorization and validation errors retain their existing policy.
Coroutine cancellation is not turned into a visible booking failure.

Feedback is scoped to the accepted search generation and account controller.
An old response cannot mark newer choices as confirmed. Changing criteria clears
old result feedback without sending anything; closing the account clears it and
rejects delayed callbacks. An explicit new search can still start a deliberate
new request. This is not a new server-side one-booking-per-parent restriction.

The original model test reproduced two booking calls from the same confirmed
result. Two of four cases failed before the correction; all four original cases
and four additional state/generation/account/rejection cases pass afterwards. Those
controller tests use explicit fake gateways, not live booking records. Original
JUnit receipts are retained in
`docs/release/evidence/local-booking-search-feedback-2026-10-17/`.

The new isolated screen replay is required by the Android runner. It uses actual
parent authentication, an actual displayed trip read from the isolated backend,
the real booking gateway/SDK and an independently verified successful reply that
is discarded before the parent presses retry. Place resolution and matching are
explicit test stubs, not provider search verification. Native CI must execute and
independently verify that case before its result can be called passing.

## Remaining Boundaries

The screen replay does not restart the process. The existing separate SDK-only
restart test remains required; it must not be relabelled as screen restoration.
The post-SDK/pre-UI acknowledgement boundary and restoring confirmation after
process death still need verification. Direct trip-list/home booking entry points
do not yet share this feedback lifecycle. iOS search feedback, physical phones,
provider matching, payments, changed-trip parent-review screens and other release
requirements remain outside this local Android search change.

No backend, rules, infrastructure or production deployment is changed. The
booking callable's existing mandatory identity/snapshot contract is unchanged.
