# Explicit Session Restoration Failure Handling

Native run [38973242518](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38973242518)
at `612d2828be6c31a8ff90243e804ac831a4576d58` failed on **2026-10-16**,
isolated run `9c2ab66da0302b7d8bcc65bfde47a028`.

The earlier local stages reached cancellation review. After rotation, the profile
initialization callable completed, then the authentication SDK reported
`unexpected end of stream`. Its uncaught exception failed the instrumentation.
There is no completed cancellation result, restart stage, network stage or final
`results.json` from this run. The failure cleanup copy is diagnostic evidence only.
The earlier independently verified restart exchange remains separate historical
evidence; this run does not repeat it.

## Root-Cause Boundary

The application called `providers.auth.currentSession()` directly in an unguarded
startup effect. That operation includes profile initialization and a forced token
refresh. An exception could escape instead of producing a recoverable startup
state. The network stream failure's underlying transport cause is not established;
the fix does not claim to repair that transport or the separate missing cellular
subscription issue.

Startup now has explicit pending/loading/failed/ready states. A failed session
read neither publishes a null session nor reveals signed-in content. It displays
a short error and two explicit actions: retry restoration, or disconnect. Only a
successful null result or the user's disconnect action opens signed-out content.
There is no automatic retry, cached identity fallback, extra timeout, suppressed
instrumentation failure or provider substitution.

The same existing logout cleanup is shared by profile logout and explicit
startup disconnect, including social sessions, account-scoped drafts and app
data. Lifecycle cancellation propagates, and disposed controllers reject late
results. Error screens do not expose exception messages or credentials.

## Initial Local Verification

Eight JVM state cases passed at **2026-10-16T22:22:18.626Z**: real signed-out
result, failed transport without silent logout/retry, explicit same-identity retry,
overlapping actions, explicit disconnect, failed disconnect, disposed late result
and lifecycle cancellation. The original XML, failure transcript and copy receipt
are SHA-256 pinned. They are not a successful device replay.

Four new component screen cases were prepared to exercise the actual restoration helper and view
with an explicitly controlled gateway: error then one retry, explicit disconnect,
loading without login actions, and narrow large-text action bounds. Compilation
does not prove those screen cases ran. At this checkpoint, their execution and
reviewed captures, plus the retained full local app replay, still required Native CI.

No production deployment, real account, live payment/refund, push or physical
tracking is accepted. Parent confirmation for changed trip terms remains required;
its native editing/review screens are still unfinished. The overall goal is active.

## Subsequent Screen Verification

The [separate screen recheck](screen-recheck/README.md), reviewed on 17 October,
confirms all four controlled component cases passed on 16 October. Both captures
were reviewed. The full Native run still failed at network preparation, and Web
Smoke failed the acceptance/cancellation transaction race. These are retained
failures, not a green complete replay or an explanation of the transport causes.
