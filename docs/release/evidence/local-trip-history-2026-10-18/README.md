# Trip History And Time Replay - 18 October 2026

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
history, large-text and idempotent month-selection cases subsequently passed in
the completed native replay below.

## Completed Native Replay

Source: `92ea11dcb87b3c2fc0bf266b437122ce73b23bdb`.
Run: 39083223705; Android UI job: 117544333585.
Artifact: 12120371476, `android-connected-ui-test-results`, 14,052,245 bytes.
Local run: `fa5204526c51182f1de9203112d01814`, completed at
2026-10-18T00:56:48.574Z. All 32 required groups pass. The 23 original local
instrumentation transcripts account for 31 native cases; all ten evidence copies
succeeded. Ordinary/component instrumentation reports 111 cases, 85 passed,
26 conditional local-only skips, no failures/errors. The three new history
component cases actually ran, including large text and repeated month selection.

The recovery matrix opens declined and withdrawn history for both parents and
the owning driver, before and after a guarded new process. Original 2.50 and
proposed 4.00 prices remain visible, closed response/withdraw/quote/apply/propose
actions remain absent and all independent record hashes stay unchanged. Both
parents' reservation times and the direct trip label match the independently
computed Brussels expectation. The time-label fix is now exercised in the app,
not only in unit tests. This does not exercise every DST boundary on-screen.

`completed-native/` retains 83 exact original files with SHA-256 hashes, including
the complete result, stages/checkpoints, receipts, transcripts and ordinary XML.
Two actual 1080×2140 history captures were visually reviewed and allowlisted for
the partner site; original app content is not edited. Maps remain unavailable in
this isolated build: neither image is evidence of working route rendering.

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

The approved private draft subsequently passed its own guarded restart stage in
source `f4ada94`; see the [separate evidence](../local-trip-drafts-2026-10-18/README.md).
That newer full run remains failed at separate capture/network-preparation checks.
The strengthened approved store-background pause still needs runtime proof.
These are separate from this completed history run. This completed source did not pause the store;
it cannot prove the update interruption is permanently fixed. No store, maps or
location service was disabled in this run and no browser was restarted.

Other draft variants, successful
route/application flows, real payments/refunds, emergency action and physical
tracking/safety evidence remain unproven. No production deployment or release
completion is claimed.
