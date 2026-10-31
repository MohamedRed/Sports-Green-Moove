# Direct Booking Confirmation And Process Restart

28 October 2026. The original controlled unit regression exercises the actual
`launchTripAction` parent branch with a declared fake booking gateway. Three taps
produce three successful gateway calls; the expected single call assertion fails.
This is not evidence of three real server bookings. Original JUnit and test source
are retained. The corrected eleven-case controller suite and all 613 local native
unit tests pass. The new two-case native component suite initially compiles only;
its subsequent CI execution is retained separately below, not inferred from that
compilation or promoted to physical response-loss proof.

The parent card now opens an explicit one-adult/one-seat confirmation. Fresh trip
terms and paginated owned reservations are read before enabling submission.
Existing active adult requests are displayed instead of another send action.
Failed/foreign history reads fail closed. Pending confirmations reject repeat
taps; a closed or changed account cannot accept a late reply. Explicit retry of
an unconfirmed response still uses the existing durable booking gateway. No new
backend uniqueness restriction, fallback, automatic retry or provider route is added.
Deliberate new searches retain their existing behavior. Driver/child ride actions
retain their separate tracking-permission path.

## Physical Phone Trial

Run `8c76ce1cfab93430f004dda079b16425` uses one physical Android phone, an APK built
from baseline `4f9a23a` plus the retained native working-tree sources, and disposable
local services. The selected upload is `sgm-direct-booking-isolated-wip-20261028.apk`.
The source APK digest is retained; installed bytes were not independently hashed.

After the phone trial, unchanged Home screen wiring was extracted into HomeRoute
to keep the app entry file below 300 lines. This later source is not the tested
APK's exact source snapshot. The separate composition-recheck retains its own
source hashes, all 92 JUnit suites (613 passed) and successful component-test
compilation log. Its first attempt had six temporary-directory creation failures
caused by a full disk; the original failed suite remains retained. Removing old
generated publication archives, without altering product code, allowed the same
command to pass. This is a local unit/compilation recheck, not another phone run.

All eight read-only checkpoints pass. Opening the home card and returning create
no booking. A single explicit confirmation creates exactly one adult, one-seat
request, one committed request receipt and one driver notification. Reopening,
an actual Android Force stop/new-process restart, opening from Mes trajets and
sign-out preserve those exact records. All original child requests, trip capacity,
unrelated documents, account claims and live data remain unchanged. The independent
observer does not submit, cancel, approve or mark anything read.

Manual session observations separately record the visible confirmation, success,
restored pending request and sign-out. Fresh package-scoped process measurements
show PID 28390 before Force stop, no process after confirmation, and PID 16709
after relaunch. Original console accessibility text is retained, not reconstructed
from the derived summary. The user-approved session captures are device-rectangle
crops of original session-window PNGs, not native exports or video. Only four
reviewed captures are published; the intermediate reopen context stays retained.

## Preparation And Disposal

The first backend preparation stopped before any phone test because the CLI
resolved an older Java from PATH despite JAVA_HOME. Its original failed cleanup
receipt remains under preparation-failures. The owned waiting helper was stopped
and disposed. A fresh backend explicitly used the installed Java 21 executable
on PATH. An initial observer entry failed before initialization because its static
client import ran before the private password was set; the corrected entry now
loads that client only after validating the private session. No original failure
is promoted to a successful flow or hidden by an automatic retry.

The parent signed out, provider uninstall was acknowledged, a fresh package query
confirmed absence and the phone returned to its idle dashboard. The observer and
backend exit 0; the explicitly stopped private helper exits 130. The observed
backend process group, both runtime directories, private session and handoff
directory are absent, and six scoped ports are independently available. No device
administration, store policy, network isolation or location permission was changed.

No real payment, map request, customer data or production write is involved.
Physical response-loss recovery, search-screen restart, simultaneous devices,
notifications/push, other accounts and full release readiness remain open.
The separate complete CI at baseline 4f9a23a still fails its focused chat-network
preparation and ride-observation lanes; this scoped product repair does not repair
or replace those failures.

Validate with `node --test tests/direct-booking-evidence.test.mjs`.

## Subsequent Native Component Execution

Native CI 40735408854 on committed source c898253 succeeds, including all three
native suite exit codes. Its original ordinary-component XML has 237 cases:
183 passed, 54 intentionally skipped, zero failures/errors. Both direct-booking
component cases execute successfully, including explicit confirmation/reopening
and large-text explicit retry with declared fake gateways. Original run metadata,
XML, suite status and terminal PR checks are retained under component-ci.

The complete PR is not green: Web Integration Smoke fails because the local
composition-recheck/gradle.log matched the repository's ignored log extension and
was absent from the commit despite being listed in the checksum manifest. Those
same original bytes are now retained as gradle.txt. The publishing command also
checks source-commit membership of evidence references and checksum-listed files;
a clean worktree alone cannot accept an ignored original. Dedicated tests retain
that clean-but-incomplete case and reject index-only files before commit.
This evidence packaging repair does not claim a production deployment, physical
response-loss recovery or a root-cause repair of intermittent capture transfers.
