# Local App Replay Scheduling

## Interrupted Replay

Native run [38871072026](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38871072026)
at `51899e10a0f5850ae056cdcdf649bb9cc86113c9` passed the first nine
isolated cases, theme restart and multi-seat checks. The ride case then failed
with CalledFromWrongThreadException: expected main, calling an OkHttp callback
thread. Later conversation, membership and network cases were not reached.
There is no completed results file or new message-recovery evidence from this run.

The original instrumentation report is retained unchanged in gzip form and as a
newline-normalized text copy. Its stack connects the SDK task's direct callback
executor to the test frame clock, recomposition and Android view measurement on
that same callback thread. This is evidence of an isolated test scheduling defect,
not proof of a production app crash or a new diagnosis of older SlotWriter errors.

The earlier completed ride and review evidence remains a dated result in
`docs/release/evidence/local-ride-ui-2026-10-15/`. Its existing screenshots are
not captures of this failed run and are not relabeled as a fresh pass.

## Separate Reservation Teardown Crash

Run [38871715330](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38871715330)
at `9201fc5ef63385891933ae07b558d8d6de9870bf` passed 14 preceding
isolated cases, including ride and both conversation cases, then crashed in
LocalBookingDecisionsFlowTest while destroying the activity. Its original
instrumentation report and crash buffer record ArrayIndexOutOfBoundsException
in SlotWriter.moveSlotGapTo during composition disposal on the main thread.
Membership and network cases were not reached; no completed result was written.

This is a reproduced local process crash, distinct from the callback-thread
failure above. The shared rule addresses the observed unconfined scheduling
problem, but this teardown stack does not establish that the scheduling change
also fixes SlotWriter. That issue remains open until independently verified;
neither a passing component test nor one later successful replay proves its
root cause or closes physical-device/account-switch coverage.

## Shared Test Rule

The ride test still used the default unconfined composition dispatcher. Earlier
conversation investigations selected a StandardTestDispatcher only in the two
message tests; that left the same scheduling risk in the other SDK-backed app
replays. A shared LocalComposeRule now queues those composition effects for all
ten isolated ActivityScenario app test classes. Component tests with explicit
fake gateways remain separate. No production code, provider behavior, timeout,
assertion or case count is changed, and the duplicate inline rule setup is removed.

Compilation and configuration checks are not a full app pass. A subsequent
completed replay is required before claiming this scheduling change is verified.
Physical phones, tracking, live payments and team conversations remain outside
this result. The agreed team-only audience is documented separately in
`docs/contracts/team-conversations.md`; no team-message flow exists yet.
