# Android Replay Diagnostics - 16 October 2026

These retained reports are diagnostic evidence, not an accepted complete replay.
No release requirement or new portal capture is accepted from these attempts.

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

All retained files are unedited copies from the corresponding downloaded GitHub
artifacts. They contain isolated synthetic test state only. Full job logs remain
at the linked GitHub run IDs, not in partner-facing copy.

## Changes Under Verification

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
No passing app replay or root-cause resolution is claimed until new execution
and saved-state evidence validate. Physical tracking, real payments/refunds,
push delivery, team/guardian lifecycle and the trip-cancellation screen remain
outside these diagnostics.
