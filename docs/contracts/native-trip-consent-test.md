# Native Trip Consent Test

`LocalTripChangeFlowTest` extends the isolated native/backend replay with three
price-change proposals and three actual signed-in app accounts. It uses the
existing Android application, authenticated callables and reservation links,
not a fake gateway or a direct database write for the user's decisions.

The host creates one driver-owned trip for each terminal outcome: confirmation,
refusal and withdrawal. Each starts at EUR 2.50 with one approved booking for each
of two parents. A new synthetic second parent has only the parent role and an
active isolated club membership; no real accounts or production claims change.
All three proposed prices are EUR 4.00. Original snapshots are taken after booking
approval, so the verification includes capacity, booking ownership and payment
metadata, not only the displayed price.

The driver proposes through the app. The first parent follows their reservation,
sees both prices, accepts the first proposal and sees one agreement out of two.
That parent refuses the second proposal without cancelling the booking. The
second parent opens their own booking, still sees one agreement out of two,
accepts, and sees both agreements recorded. The driver then sees confirmation
but cannot apply without a route quote, and withdraws the third proposal through
the app. Native actions require actual controls and keyboard/window readiness.
Reservation rows can appear before the parent refresh finishes. The test waits
within its existing 60-second budget for the exact review control to be enabled,
requires no reservation error, then makes one click. Presence alone is not ready.
Four synchronized dialog captures retain the first agreement, both agreements,
refusal and withdrawal. They require separate visual review before portal use;
passing semantics or a non-empty bitmap does not prove that maps rendered.

The host waits for a successful instrumentation transcript and an acknowledged
device evidence copy before inspecting persisted records. It requires one
proposal per trip, exact parent/booking sets, the expected decisions, unchanged
original trips and bookings, five unique notifications per proposal, private
parent views, outsider denial and denied start of the unapplied confirmed trip.
The run-bound device receipt cannot substitute for those independent checks.

`trip-change-ui-stage.json` is emitted only after this scoped stage passes. It is
explicitly not the full replay result. The existing network-cut stage and every
other group remain mandatory; only all 25 cases/groups can emit `results.json`.
No failed or skipped instrumentation may yield a successful scoped receipt.

This covers proposed-price consent, refusal and withdrawal. Time/address entry,
route calculation, applying the agreed details, payment adjustments/refunds,
process-death recovery, historical review and physical-device usability remain
separate requirements. No provider substitute or production deployment is added.
Compilation and configuration checks are not evidence that this native case ran.

## Independent Required Suites

The device prerequisite guard remains mandatory before any app test. Once it
passes, ordinary connected tests, their capture collection and the isolated
backend/native replay retain separate outcomes. An ordinary test or capture
failure does not suppress the other required replay. This is not an alternative
success path: the job returns nonzero if any required outcome failed. The first
failure is preserved as the exit status and all three statuses are written to
`native-suite-status.json`, explicitly labeled as exit metadata rather than flow
verification. No test, retry, capture assertion or full-replay gate is removed.
Shell-harness regression cases prove success, each individual failure, combined
failure and a denied device prerequisite without using a real user or device.
