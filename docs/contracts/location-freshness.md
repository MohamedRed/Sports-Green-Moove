# Location Freshness

Position age means time since the position was observed, not time since it was
uploaded or its webhook arrived. The server snapshot uses `capturedAt` in integer
epoch milliseconds and the existing 90-second freshness limit. A delayed upload
cannot reset that age; child observation ordering uses capture time as well.

An absent, non-positive, non-integer, unsafe or future observation time is
unverified. A received point with such a time displays `Position à vérifier`,
not `à l'instant`. A vehicle with no point retains its distinct first-point
waiting state. No timestamp is guessed from receipt time, and old records are not
silently migrated. Native receipt timestamps are stamped on the server while
preserving the submitted capture time for audit. Authenticated identity and native
source remain authoritative; a parent cannot write a driver point.

The local authenticated checks and original before/after unit outcomes are under
`docs/release/evidence/location-freshness-2026-10-19`. They prove response formatting
and callable authorization/storage only. They do not prove live phone location,
continuous UI refresh, child-specific warnings, map movement, out-of-order update
handling, clock-skew UX or provider webhook delivery. Those requirements remain
open in the real-device protocol; do not accept them from these local results.

## Observation Ordering

The shared live-location writer atomically compares `capturedAt` at the exact
vehicle or child-device register. A strictly newer, positive safe-integer capture
time at or before server time can replace the current point. Older and equal-time
points do not alter coordinates, source or receipt time. A valid incoming point
may replace an unverified stored record; no automatic backfill is performed.
Unknown, malformed and future incoming times are ignored rather than installed
as the current point. Device clock-skew handling still requires explicit UX.

`writeLocationBatch` returns `written` for committed point transactions and
`ignored` for points not committed. Authorization is checked for the whole batch
before any write. The common writer is also used by provider reconciliation,
which reports the actual commit result while retaining the event's separate audit
processing. This does not make ETA metadata monotonic or verify webhook delivery.

The negative reproduction and completed ten-group isolated replay are retained in
`docs/release/evidence/location-order-2026-10-19`. They cover actual native
callables and the shared administrative writer/reconciler, not continuous UI,
child-device authentication, physical GPS or real provider traffic.
Transaction comparison time is sampled on every reevaluation, not frozen before
the write; otherwise a later valid capture could be misclassified as future.
The additional negative/positive protocol verification and repeated service run
are in `docs/release/evidence/location-order-reevaluation-2026-10-19`.
