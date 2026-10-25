# Server Clock Contract Preparation

25 October 2026. This is the backend stage of the clock-rejection repair, not
a corrected phone flow. Android still uses the earlier capture-time behavior.
The physical attempt remains blocked and its original images/dates are unchanged.

`getActiveRide` now returns a response-time `serverTimeMs` after its existing
authenticated ride lookup. `writeLocationBatch` returns the same metadata after
its authorized writes and receipts. An absent ride remains null. Rejected access
and transaction errors still fail; caller-supplied clock fields are rejected.
Capture validity, per-user writes and atomic ordering rules are unchanged. Future
points are not accepted and capture time is not replaced with receipt time.

The retained isolated run executes eleven location-order/clock groups, including
twelve concurrent writes, duplicate retention, independent child registers,
parent reads and an invalid future native capture. Nineteen response observations
bind server time to local request/response bounds. They contain synthetic IDs and
timestamps only, without credentials or real location data. These bounds are
local contract checks, not a measurement of mobile network delay or clock drift.

The complete backend unit run passes 480 cases, including twelve new callable
clock cases. Its source snapshots and the service run's snapshots are retained by
SHA-256. The completed service log records emulator shutdown, the Admin client
closes naturally, and a later observation verifies all four loopback ports can
be exclusively bound and released. No cloud backend is deployed.

The next stage must tie the server reference to the device's monotonic clock and
the active authenticated ride. Delayed captures must remain old; clock updates
must not make replayed captures look new. Session/ride changes, late responses,
restart and invalid clock data need coverage before a fresh phone replay.
No native UI, physical movement, background/locked-screen behavior, iOS,
provider delivery, release manifest item or production acceptance is added.
