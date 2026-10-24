# Displayed Booking Agreement — 17 October 2026

Local prerequisite for the owner's parent-confirmation policy, not the completed
trip editor. No production deployment, physical-phone acceptance, real charge or
refund occurred. Existing recordings/captures keep their original scope and date;
this report adds handler and native data-binding checks, not a new app video.

## Before And After

- `before.json`: actual compiled `f130e9ebd17fc61810235bada56eae04992c91c1`
  booking handler, isolated `demo-sgm-local-qa`, run
  `9ab238c9128e5e3df60b347a942b4822`, 04:57:03 UTC. **4/22 passed**.
  Sixteen changed operational snapshots and two missing/malformed snapshots were
  accepted incorrectly. The displayed snapshot was captured before mutation and
  before invoking the handler, not invented after the request.
- `after.json`: current production sources, hashes embedded, run
  `3d21ae2d233fce3234c5fdc4c4ae1ce0`, 05:08:56 UTC. **25/25 passed**.
  The same 18 cases now reject without a booking. Cosmetic-title changes, current
  availability, unchanged terms and a deliberately reviewed new price remain
  valid. Two seats at 900 cents persist 1,800 cents, with the correct revision.
  Three additional positives cover persisted Timestamp/Date and equivalent ISO
  instants. They were not executed against the original 22-case baseline.
- `consistency.json`: **14/14 passed**, current source. Preserves transaction
  retry/guardian revocation coverage and the actual proposal → parent acceptance
  → application race. Route responses are synthetic; no money moves.

The first baseline loader attempt failed before scenarios because it initialized
Firestore twice. It produced no result JSON and is not business-safety evidence.
The corrected loader loads the selected handler's configured database only once.
An earlier current-source 22-case pass predates the date fix below and is not used
as the final receipt. Original temporary outputs were not overwritten.

## Regression Found During Wider Checks

`services-before.json` records **20/24 passed**, run
`8d33bd6d3f7856d051f4a33c24455f29`, 05:00:35 UTC. Publication, multi-seat booking,
reservation decisions and trip cancellation failed because valid legacy
Timestamp dates were rejected by the new snapshot mapper. This failure remains
unchanged. The fix normalizes actual persisted values, without fabricated dates.

`services-after.json` records **24/24 passed**, run
`9df213040f16a7aaef79c2e81f647f54`, 05:03:55 UTC. This is isolated service evidence,
not a phone replay. `functions.json` records **233/233** unit tests passed.

## Native Binding

- `android-snapshot.xml`: 4 executed JVM tests, including malformed field cases.
- `android-mapping.xml`: 4 executed JVM tests for direct-document/search parity,
  Timestamp/Date documents, mismatched IDs and absent snapshots.
- `android-payload.xml`: 5 executed JVM tests for selected seats/child and refusal
  of missing/invalid snapshots. No adapter re-fetch replaces displayed terms.
- `android-binding.xml`: 7 executed JVM controller tests, including the exact
  displayed object surviving a later result and refusal of mismatched trip IDs.
- Android unit suite and instrumentation compilation passed locally. These XML
  files are JVM tests, not executed native UI or SDK integration evidence.
- `swift-wire.json`: **15/15** Foundation contract cases, actual production
  `Models.swift`/`BookingIntentSnapshot.swift`, compiled with Swift 6. Selected two
  seats, child, null arrival, persisted dates, malformed values and old displayed
  terms are checked. Host package build also passed, but excludes Firebase SDK
  branches. No iOS phone/UI recovery claim or paid iOS CI activation is made.

The backend requires `expectedBookingIntent`; both native entry points carry the
displayed summary. Comparison stays fixed across transaction retries. Invalid
metadata is rejected, not silently repaired. The snapshot is client-reported and
compared with current authoritative data, not a signed quote/payment consent.
Server/client releases must be coordinated; this mandatory API is not deployed.

## Remaining

Uncertain-response booking idempotency, child-list refresh after guardian loss,
full iOS SDK/recovery checks, actual driver-edit/parent-decision screens and
financial settlement still need work. The intermittent missing mobile data
subscription in the wider native replay remains unexplained; this change does
not retry, skip or suppress it. Physical tracking and real safety-audit evidence
remain required. The release goal and reservation flow stay incomplete.

Web Integration Smoke runs the current displayed-snapshot harness, Swift wire
check and retained-evidence validator, and uploads fresh receipts. Historical
failures are byte-pinned by `tests/booking-display-evidence.test.mjs`.
