# Trip History And Interrupted Time Replay - 18 October 2026

## Verified Locally

`services.json` is the original successful isolated run
`0bc861052ea7b29c075f707c2f5cc0de`, completed at 00:26:14.277 UTC. It called the
real local authenticated endpoints against disposable data, not UI mocks or
production. Thirteen proposals were actually created and declined/withdrawn.

- Both initial parents and the driver retrieve all 13 across ten-item pages.
- The later parent sees only the 7 proposals that affected that parent.
- Microsecond differences within one millisecond and exact timestamp ties retain
  stored-time/document-ID ordering, without duplicates or omissions.
- Direct reviews include only the requesting parent's booking IDs and closed
  proposals offer no response/withdrawal actions.
- Signed-out, cross-account cursor, cross-trip cursor, unrelated trip and forged
  caller identity attempts are rejected. Removing guardian authority rejects
  both listing and direct review. Forging the stored parent list does not grant
  access without an actually affected booking.
- A cancelled booking retains authorized history. Before/after hashes prove
  history reads do not mutate trips, bookings, proposals or notices, both before
  and after that explicit cancellation.

The first standalone attempt stopped because its outsider fixture was not
created by the base seeder. Setup now creates its own named isolated parent.
The second attempt exposed an invalid test precision assumption: timestamps at
0-4 nanoseconds are stored as the same microsecond, so they cannot prove distinct
chronological order. The fixture now uses explicit microsecond steps, verifies
the persisted value, and retains the exact-tie/document-ID test. This follows
the [documented storage precision](https://firebase.google.com/docs/firestore/manage-data/data-types),
not a transport fix, retry or weakened ordering assertion.

`functions.json` retains 258/258 passing backend cases. `unit/` retains the
successful 4-case Android history controller and 2-case strict wire mapper
reports. The complete Android unit suite passes 234/234, and the new native
history, large-text and idempotent month-selection cases compile. Those native
cases have not been executed on the changed history source yet.

## Prior Native Replay Was Interrupted

Source: `f10c962195ea01de94e8b7f4073a20b3b4652f0f` (time fix, before history).
Run: 39081903818; Android UI job: 117540406995.
Artifact: 12119632100, `android-connected-ui-test-results`, 10,640,466 bytes.
Local replay: `f433b939405b9a05db27b6fb9c6be01d`.

The local app process 8279 stopped at 00:25:16.313 UTC during
`LocalBookingDecisionsFlowTest`. Android exit info records reason 16,
`PACKAGE UPDATED`, with `stop com.google.android.gms due to installPackageLI`.
The matching process log shows that exact PID killed for that installation.
Package operations record the GMS package update at 00:25:16.142. The typed
installer dump records active session 1831130581, initiated by
`com.android.vending`, committed at epoch milliseconds 1792283116018, and the
frozen package list has GMS refCount 1. The Java crash log is empty.

`interrupted-time-replay/` preserves 14 original files with SHA-256 hashes,
including these seven read-only diagnostics, the failed transcript, suite status,
successful bounded evidence-copy receipts and ordinary instrumentation XML.
Ordinary/component tests succeeded; the local replay failed. The time assertions
and four-state consent recovery were not reached. Successful cleanup/copy does
not complete that run. This is evidence of a system-service update interruption,
not a successful time fix replay or evidence that every app crash is explained.

## Still Open

The native matrix now enters closed history for both parents and driver, before
and after the guarded restart, and requires new captures and explicit receipts.
No new history/time-fix image is published yet. The prior reviewed 17 October
captures remain historical. Approval to pause app-store updates on the
disposable test device is pending; no store, maps or location service was
disabled and no browser was restarted.

History UI execution, current native time display, unsent drafts, successful
route/application flows, real payments/refunds, emergency action and physical
tracking/safety evidence remain unproven. No production deployment or release
completion is claimed.
