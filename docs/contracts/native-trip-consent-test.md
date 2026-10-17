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
