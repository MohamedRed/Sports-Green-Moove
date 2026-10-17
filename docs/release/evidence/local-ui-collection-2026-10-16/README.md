# Android Replay Diagnostics - 16 October 2026

The earlier failed-attempt files are diagnostic evidence, not an accepted complete replay.
They do not accept any release requirement. The separate completed local run is below.

## Completed Local Replay

[Native run 38928467348](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38928467348)
passed at application/test commit `997f7fff7b048272f529bb8bb85025ff21f7854f`.
`accepted-run/results.json` records run `ae951a8d5861e55da4e444dbfc751e8f` at
`2026-10-16T16:15:50.682Z`: 20 instrumentation cases and 21 verified groups,
including the independent saved-data checks. `component-after.xml` separately
records the ordinary 69-case suite with zero failures and 15 intentional skips.
The conversation's six component cases pass with the same request/body assertions.

All three file-copy receipts completed with exit zero, no signal/error and the
same recorded host tool version, `37.0.1-15733141`. No failure-cleanup copy was
needed. Two reviewed, unchanged app-only captures show the retained draft after
a rejected retry and the final single confirmed message. They do not display
the system keyboard or prove full-app navigation for that controlled-fault case.

The saved checks confirm one message/one notice for controlled reply loss, two
messages/two notices after the separate OS disconnection/recovery case, confirmed
chat restart, and zero duplicates. The four search component cases still use
explicit fake gateways; other scopes and limits remain in the result JSON.
This is complete local replay evidence only, not physical or production evidence.
One passing run does not establish why the earlier transfer or data-subscription
setup failed. Their reliability remains open; no automatic retry or fallback was
added. Historical bytes, including line endings, are pinned in `artifact-sha256.json`.

## Separate Failures

1. Native run `38919957339`, attempt 1 at application commit
   `c9a8300cdd291ebd88d00c9ea1dc443e60a28969`, local run
   `3b96c544b35c200db6cf14cc61e14496`: network preparation failed before the
   disconnection case. The retained device receipt shows no default data
   subscription and no cellular callback or internet transport, despite Wi-Fi
   and a reachable isolated backend. No root-cause fix is claimed.
2. The same Native run, attempt 2, local run
   `6f43720bb06338239b4827fb623124c4`: the retained 12 instrumentation
   transcripts report 20 passing cases. The device network receipt is completed,
   including a real offline interval and explicit retry. The final `adb pull`
   exited 1 before saved-data verification and generation of `results.json`.
   A later cleanup copy does not convert the failed replay into a passing one.
   The retained device receipt cannot prove saved message/notice counts alone.
3. Native run `38925568249` at diagnostic commit
   `3e11dccd1ecf75bf4c76066d5f79942def058510`: the ordinary component suite
   stopped at `ConversationFlowTest.uncertainSendsKeepTheirIdentityAndTextUntilTheRetryIsConfirmed`,
   waiting for the first simulated send-error text at line 56. The original XML
   reports 69 cases, one failure and 15 intentional skips. It did not reach the
   separate local-service replay or exercise the new copy collector.

The retained XML, device receipts and instrumentation transcripts are unedited
copies from the corresponding downloaded GitHub artifacts. They contain isolated
synthetic test state only. Full job logs remain
at the linked GitHub run IDs, not in partner-facing copy.

## Verification Changes

The copy collector now retains redacted, phase-specific command diagnostics and
still fails on every nonzero exit, timeout, signal or launch error. It does not
retry a transfer, restart a device, accept a cleanup result as the primary
result, or bypass the independent saved-data checks. This adds observability;
it does not explain the original transport failure.

The component test previously typed then immediately touched Send without an
explicit keyboard-transition or enabled-button precondition. The failed run's
logcat shows the keyboard opening around that interaction; the report alone
does not prove whether the tap was missed or the UI state failed. The test now
waits for real keyboard visibility and the end of inset animation, checks the
button against the visible window, performs the same physical touch, and checks
that the gateway actually received the request. The error-text deadline remains
five seconds and request-ID/body assertions are unchanged. First sends keep the
keyboard open; the retry steps explicitly dismiss it and wait for dismissal.

No production app behavior has been changed by these test-harness changes.
The passing local replay is qualified above; no original transport root-cause
resolution is claimed. Physical tracking, real payments/refunds,
push delivery, team/guardian lifecycle and the trip-cancellation screen remain
outside these diagnostics.
