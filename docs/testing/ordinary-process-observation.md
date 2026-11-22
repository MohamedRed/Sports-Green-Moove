# Ordinary Android Process Receipt

The full ordinary instrumentation command retains its original 12-minute host
deadline, 240-second per-test limit, 16 MiB output bound, unfiltered discovery,
redaction, installation guard and complete JUnit validation. There is one command,
not an automatic retry. A nonzero/null exit, signal or host process error still
fails before parsing or writing a successful test report.

`ordinary-process.json` now retains the monotonic command duration (`elapsedMs`)
and the exact allowlisted host process error code. This distinguishes `ETIMEDOUT`
from `ENOBUFS`, missing executables, permission failures and other recognized
launch/resource errors. Unknown codes are recorded as `UNCLASSIFIED_PROCESS_ERROR`,
not no error; their raw values, messages, paths and arguments are not copied.
Existing stderr redaction happens before the receipt projection.

An external signal without an error code is not classified as a timeout. A
successful host exit is not proof that every test passed: the existing strict
transcript parser and failed-case assertions remain authoritative.

Earlier receipts remain immutable. In particular, the 9450ad0 ordinary receipt
retains SIGTERM and `INSTRUMENTATION_PROCESS_ERROR`; it does not establish which
host error caused that interruption. The new projection cannot reconstruct a
missing historical code or establish why a particular test was slow.

The focused tests exercise a real local Node process timeout without Android,
network traffic, provider calls or account data. They also cover every allowed
code, unrecognized values, external termination, nonzero exits, redaction
boundaries, runner assertions and unchanged limits. They run through the existing
`tests/android-junit-transcript.test.mjs` command in Native CI and Web Integration
Smoke; source and test changes are included in both path filters.

This is an instrumentation diagnostic correction, not an app-flow fix, a completed
Android run, a deadline increase or release evidence. No device has been manually
restarted and no paid resource or infrastructure configuration has changed.
The public progress site remains unchanged until there is a new reviewed flow
result or blocker to report.

## Interrupted Execution Observations

Before this correction, a host timeout or incomplete transcript throws before
the existing primary-capture collector runs. The failure handler collects process
and rejected-bitmap diagnostics, not the already recorded capture timings. A
successful matrix collects those timings; an interrupted matrix loses them.

The runner now validates the host result and full transcript through
`requireOrdinaryInstrumentation`. If either fails, it attempts the existing
bounded, read-only capture-timing copy once when diagnostics are enabled, then
throws the same original failure. Incomplete or missing observations cannot
accept the run. Copy/validation errors cannot replace that original failure or
trigger another attempt. Completed passing and failing reports retain their
existing single collection path and complete-inventory checks.

The 9fd5bf3 run confirms `ETIMEDOUT` after 720007 ms, with case 336 of 349 started
and no final runner code. It does not prove that case itself stalled or that
there was an app crash. Its separate connected replay fails during guardian
screen lookup; the independently focused network case fails in preparation
without any network cut. None is repaired or accepted by retaining diagnostics.
