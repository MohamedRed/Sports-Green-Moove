# Local Search State Regression Evidence

Date: 2026-10-15 UTC. These are synthetic JVM/controller checks, not physical
phone, live place-provider or real-account evidence. Original Gradle JUnit XML
files are copied unchanged. No production data or cloud resources were used.

`requests-baseline-failed.xml` records four failures against `bf86a60`:
out-of-order suggestions, resolved places and search matches overwrote newer
results, and cancelled booking work still published error/loading callbacks.
The separate initial test-fixture compilation error was corrected before this
baseline execution; it is not counted as a reproduced application regression.

After correction, `requests-passed.xml` has four passing cases,
`lifecycle-passed.xml` has six, and `safety-passed.xml` has five: 15 total,
zero skipped, failed or errored. The full Android unit suite and instrumentation
APK compilation also pass locally.

## Verified In These Checks

- Only the latest request for each place field or match list may publish.
- Origin and destination requests are independent; loading lasts until both end.
- An edited place loses its old coordinates and invalidates pending matches.
- A new invalid search cancels the previous search instead of showing its result.
- Required child selection and guardian consent are checked before searching.
- Current network failures remain explicit; no replacement place is invented.
- Closing clears cached places, suggestions, matches and completed-search state.
- Closed handlers cannot start a new provider request, including queued writes.
- Already-started operations that ignore cancellation cannot publish after close.
- Repeated taps while a booking request is pending dispatch only one write.
- Cancellation is not turned into an error or a stale loading/notice callback.

The controller has a child coroutine lifetime and per-request revisions. It is
remembered by authenticated UID, disposed when that identity changes, and closed
synchronously before app logout. The search route keys its field/form composition
by controller identity. Main-app loading is reset by logout, not by an obsolete
request. Static wiring contracts and compilation complement the state tests.
Input fields/components were extracted without replacing working search options.

## UI Replay And Remaining Scope

Two new `SearchSessionFlowTest` cases are compiled and included in both connected
tests and the isolated local runner. They exercise actual search controls and
the session-keyed composition with explicit fake gateways. Their session switch
is a host UID change, not a real sign-in. They still need a fresh complete run
and reviewed captures before acceptance; no new screenshot is published here.
The runner now requires 11 local cases, retaining the preceding nine-case suite.

Cancelling a client does not roll back a booking already accepted by a server.
No server-side cancellation, settlement or cross-account authorization guarantee
is inferred from these client tests. Other authenticated action callbacks,
payment callbacks, role changes and the earlier unexplained lifecycle crash
remain outside this correction. See [session-state scope](../local-session-state-2026-10-15/README.md)
and [crash attempts](../local-chat-directory-2026-10-15/ui-attempts.md).

Complete search-option changes and navigation, ranking, remaining capacity,
reservation, network recovery and multi-phone behavior remain to be exercised.
No final release-manifest requirement or iOS flow is accepted by this report.
