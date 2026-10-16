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

## Completed Replay

Native [38873286429](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38873286429)
passed all enabled jobs at `6d86b8f952d785d2e16064cc36fed324603b04bf`.
The unmodified result records run `62d83d64a7752b4a9df39e6b6bdb5a55`, completed
at 2026-10-16T08:36:29.150Z: all 17 isolated cases and 19 coverage groups pass.
The four search component cases retain their explicit fake gateways.

The ride and reservation cases that interrupted the two earlier runs both pass
in this replay. This does not establish the SlotWriter root cause or close the
older crash investigation. One successful run is not general reliability proof.

The network receipt records connected, reachable cellular handover, both radios
disabled with zero internet networks and an unreachable backend, then restored
original settings and a reachable backend. The baseline already had both Wi-Fi
and cellular networks: this does not prove the earlier Wi-Fi-only startup issue
cannot recur. Wi-Fi was enabled again, but the active route at measurement was
cellular, not a proven identical Wi-Fi association.

The app retains the unconfirmed message, explicit retry succeeds, and the driver
replies. Independent checks confirm exactly two intended messages, no duplicate,
two correctly addressed read notifications, no unread count for either actor and
no cross-account draft. The original, reviewed `local-chat-network-received.png`
shows both messages with the header, composer and navigation correctly framed.
It is newly allowlisted; older poorly framed captures remain excluded. The
passing instrumentation report is retained separately from the interrupted runs.

The application is not deployed to production. Physical tracking, live payment,
push, post-commit acknowledgement loss, full conversation process restart and
team access are not accepted by this replay. Release evidence requirements remain
unchanged. The partner site remains private and labels these results as local.

## Later Transport Interruption

Run [38875454665](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38875454665)
at `cab9b51d8fa984c8a11cec75dbe675967295046d` records all 17
instrumentation cases passing, including network recovery. Immediately after
that case, ADB reported the disposable device offline. Its saved receipt and
captures were not collected, final independent verification was not reached,
and no results file was produced. This is not another accepted complete replay.
The nine original instrumentation transcripts are retained in
`transport-interrupted/`; they prove case completion, not final verification.

The outer cleanup then failed while resetting the mock-location permission and
masked the original failure. Session-file removal was never attempted after
that exception. The retained workflow excerpt records this sequence; it does
not establish why the transport disconnected or prove an app regression.

The next version waits, with a fixed command timeout, for the same explicitly
disposable device to become available before evidence reads and cleanup commands.
It confirms the transport state and QEMU identity, without restarting a device,
server or test. All cleanup steps are attempted and original/cleanup errors are
preserved together. A missing receipt cannot be inferred from a transport error.
Success is written only after independent verification and successful cleanup.
This preparation still requires a complete replay; prior completed evidence is
retained without promoting this interrupted attempt or closing release gaps.

## Cellular Readiness Still Unresolved

Run [38877951653](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38877951653)
at `dfb6aa6f8fb9ed1fb8c968dce1d3292ec14c1a23` passed the preceding
16 isolated cases, then timed out at the unchanged 30-second cellular-readiness
wait inside LocalEmulatorNetwork.disconnect. The original instrumentation report
and receipt are retained in `handover-interrupted/`.

The baseline had Wi-Fi only. After Wi-Fi was disabled, there was no active
network or reachable backend, but mobile data remained enabled and no cellular
transport became available. The readiness callback failed before the subsequent
mobile-data-disable command; this is not evidence of an unconfirmed app send or
message retry. The receipt is incomplete and no final results file was written.

Unlike the previous transport interruption, diagnostic collection and cleanup
completed and the original instrumentation failure remained the reported error.
The connection-handling change improves collection/error preservation, but does
not fix this cellular setup problem. A deterministic, verified cellular test
configuration is still needed; no retry, skipped assertion, timeout increase or
alternate network path has been added to turn this failure into a pass.

## Completed Repeat And Explicit Preparation

Run [38880440467](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38880440467)
at `99748d2493508c5ac099a06a586b4ff8bb76263e` completed all 17 cases
and 19 coverage groups. The original result, network receipt and instrumentation
transcript are retained in `completed-repeat/`, run
`f8ff172474a879116b4a44015a717301`, tested at 2026-10-16T09:37:05.618Z.
Independent persisted checks again found exactly two intended messages, two read
notifications and no duplicates. Cleanup completed before results were written.
This run also began with both Wi-Fi and cellular networks; it does not resolve
the Wi-Fi-only startup condition or establish general reliability.

The next test setup explicitly requests a cellular INTERNET network, only when
mobile data was initially enabled, before any radio changes. Android documents
this public [requestNetwork use case](https://developer.android.com/develop/connectivity/network-ops/reading-network-state)
while Wi-Fi is connected. CHANGE_NETWORK_STATE is added only to the isolated
local-debug manifest, not the production app. All disposable/demo/loopback guards
run before the request. The setup waits at most 30 seconds for actual expected
transports and a reachable local backend; it does not bind the app to a route,
change global settings, restart a modem, retry a test or enlarge existing waits.

The request remains registered through the unchanged cellular handover, fully
offline send and explicit recovery checks. Both actual radio flags must be off,
all internet networks absent and the backend unreachable before sending offline.
The original flags are restored and the callback is explicitly unregistered in
finally, including failed preparation. New receipts must prove the registered
request, prepared transports and eventual release; historical receipts remain
immutable and use their original validator. Compilation and unit/configuration
checks pass, but a complete replay of this new preparation is still required.
No new physical, production, safety or payment evidence is accepted here.
