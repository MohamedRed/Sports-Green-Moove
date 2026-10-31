# Android Trip Cancellation Replay

## Current State

The corrected isolated Android replay passed at application commit
`e290eb85473ed4ed396200ddd46e498393eb0add`, Native CI `38942867114`, local run
`4043ac86a7274758c6e74a9212987c66`, tested `2026-10-16T18:07:54.115Z`.
All 21 instrumentation cases and 22 verified groups passed (13 transcripts).
The ordinary component suite had 73 cases, zero failures and 16 intentional skips;
all three cancellation component cases executed and passed. Fourteen new logic
tests pass locally. These counts describe separate suites, not 94 user flows.

The driver kept the trip once, reviewed two reservations, entered a reason and
confirmed in landscape. After returning to portrait, the cancelled trip was found
in history with no cancellation action. A real account switch then showed the
parent both cancelled reservations and the pending-refund label. The parent's
inbox SDK returned the single matching stored notice; this was not a push test.

Independent host checks verified the durable receipt, both closed bookings,
three originally offered seats restored (not all four seats), exactly one notice,
same-request idempotency and rejection of rebooking, approval and starting.
`results.json` retains that outcome and all earlier replay groups. All three copy
phases exited zero. Strict response-loss, cellular/network and process-restart
receipt validators and all 13 transcripts were independently rechecked after
download. Raw results, diagnostics, transcripts, receipts, component XML and five
reviewed captures are retained unchanged and pinned by `artifact-sha256.json`.

The history capture places the cancelled card near the lower edge after scrolling
to its status; it is not a clean calendar overview. The parent capture retains the
real in-flight refresh indicator above the already loaded cancelled reservations.
Neither capture was edited to remove application UI. The portal uses the reviewed
confirmation and parent captures, not a fabricated screen or video.

## Interrupted Runs

- Native CI `38936020317`, application `1b5394f`, local run
  `cd747adcf30c2ebd18343a4b720b20a1`.
- Native CI `38936588940`, application `8db1e51`, local run
  `fb7ec1dca642da8b74918814b76d0394`.

Both ran the real local app through a confirmed driver cancellation, then failed
at `LocalTripCancellationFlowTest.kt:74`: the test tapped the trip-navigation
control immediately after portrait orientation was restored, before the recreated
authenticated app had exposed that control. Parent/history assertions and host
saved-state verification were not reached. Neither run has a completed results
JSON and neither is accepted as a completed flow.

The ordinary component suite in the first run had 72 cases, zero failures and 16
intentional skips, including the two new cancellation component cases (ownership
and large-text unknown-reply recovery). This is separate from the interrupted app
replay, not 72 executed user flows.

Commit `66a1334` waits for the actual recreated authenticated navigation before
the next touch. It also waits for the confirmed app refresh before taking the
outcome capture. No sleep, automatic retry, semantic-click bypass or removed
parent assertion was introduced. The original interrupted transcripts and copy
diagnostics are retained byte-for-byte.

The next run, Native CI `38938141092` at `66a1334`, local run
`dade9e2403fd255fc7c9194c3630707f`, passed that navigation boundary but timed out
waiting for the cancelled-status node at source line 78. Parent and independent
saved-state checks again were not reached, so that run is also incomplete.
Inspection found that past cards still used a disabled clickable container,
merging their child labels. Commit `3a15c1a` removes interaction semantics from
closed history cards and adds a component regression that reproduces the old
merged-label behavior separately. The next replay must still prove that the
actual saved trip is present and readable. A best-effort screenshot/query
diagnostic now preserves the original failure if that assertion fails again.

Native CI `38940569037` at `3a15c1a`, local run
`0a3405d19d823a6e5c4d98c1d4b76c7a`, passed the 73-case ordinary component suite
(zero failures, 16 intentional skips), including the new old/new history
semantics reproducer. Its full app replay stopped earlier, at the existing
landscape-login case's 60-second home-screen wait (source line 56), before reaching
cancellation. The log alone does not establish why that submit was not confirmed.
The login harness now explicitly waits for window focus and actual keyboard
visibility/animation completion, dismisses the keyboard, and touches the visible
enabled submit button once. The original home deadline and login assertion remain.
Failure diagnostics record only readiness booleans and a phase, never credentials.
The final replay passes with those preconditions. The old login timeout lacks
enough observations to prove its original cause; no general crash, transport or
SDK-version root-fix claim is made.

## Scope

Only the isolated demo backend and synthetic accounts/records are used. A paid
reservation is represented by fixture metadata, not an actual charge. There is no
refund settlement, push-delivery, physical-device or production-deployment claim.
The previous service/rules/payment-ordering evidence remains in
`../local-trip-cancellation-2026-10-16/` with its original counts and scope.
