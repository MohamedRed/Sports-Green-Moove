# Local Multi-Person Flow Checks

Use `npm run test:local-flow-isolation`, then `npm run test:local-flows` with Node
22 and Java 21 available. Set `SGM_LOCAL_FLOW_OUTPUT` to an absolute destination
outside the temporary runtime when retaining evidence.

The runner owns a fresh disposable emulator session and refuses non-demo or
non-loopback settings. Do not run against already occupied emulator ports. No
cloud credentials, actual provider keys, production accounts or billing are
needed. Network calls from the copied Functions build are limited to loopback.

Fixture generation and the lifecycle smoke script now require this guarded demo
configuration and the generated `SGM_QA_PASSWORD`. Do not point the older native
device shell helpers at production or publish their raw credential-entry captures.
The local API suite does not install an APK or verify phone UI behavior.

The focused session-restoration case records `session-transport-observations.json`
at sign-in, screen and orientation boundaries, and on failure before cleanup. The
guarded disposable app records only capability flags, transport categories and
monotonic times. A single bounded TCP connection per local auth/functions/proxy
endpoint is observed before sign-in and on failure, without HTTP payloads, token
logging, network changes, readiness polling or authentication retries. A connected
socket proves neither service health nor flow completion. The host validates all
eight ordered boundaries for a completed case while retaining the original UI,
proxy, identity, stored-state and disposal requirements. Partial observations
stay diagnostics; previous failed artifacts remain unchanged. Run
`node --test tests/session-transport-observations.test.mjs` for the schema and
integration contracts. This does not establish the cause of earlier transport or
portrait-return failures, or replace physical network-loss testing.

The independent `team-draft` focused lane prepares an unsent parent message,
verifies that no shared message was created, force-stops only the local app, and
requires the draft in a second actual process. One explicit UI send must be read
by a separate driver SDK client. A second verified stop and third process must
show an empty composer; changing to the driver account must not recover the
parent draft. Three instrumentation transcripts, two process-stop receipts,
original captures and independent message/operation counts are mandatory. This
adds no automatic send or retry and does not replace the other focused lanes.
The lane and its schema contracts are not themselves proof that recovery works.

`test:location-freshness` separately runs actual isolated driver/parent callables.
It verifies server-bound receipt time, delayed capture age in the parent response,
refused parent driver uploads and a recent point retaining its real observation
age. It closes the administrative database client before writing a successful
report. These data checks do not prove phone UI refresh, GPS or provider delivery.

`test:location-order` reproduces delayed and duplicate native uploads and twelve
concurrent requests, verifies parent access, and exercises the shared location
writer plus delayed-event audit reconciliation. Its ten groups preserve separate
vehicle/child registers and count only committed points. Direct administrative
writer checks are not child-device authorization or signed-webhook evidence.

`test:ride-observation-services` checks authorized selected-id snapshots, structured
capture ages and remote lifecycle responses across two active rides.
`test:ride-observation-ui` independently tests the actual parent app with an
authenticated driver SDK peer, synthetic points, real elapsed aging, rotation,
background/resume and completion/history. Its fresh local-app reset is explicit
and limited to the two `.local` test packages; it never retries a failed install.
The original full multi-user replay remains mandatory and unchanged. Native CI
requires both replays plus the ordinary tests, capture collection and restoration.

The expanded `LocalRideFlowTest` checks active-ride emergency entry for the driver
and parent before its existing completion/review assertions. Both contacts are
chosen and removed through the app, with actual dial-only handoffs and return to
the same ride. `ride-emergency-evidence.mjs` requires two ordered actors and eight
original captures, including the action screens and actual dialer windows. The
host requires the primary `ride-emergency` copy, the original successful test
transcript and four independently stored own-only operations. Two null revisions
are retained; records are not falsely reported as deleted. Compilation/typed unit
fixtures never count as this journey's execution, phone proof or store acceptance.
`test:ride-emergency-fixture` separately uses actual isolated parent/driver
callables to exercise that same stored-state verifier. It also rejects a foreign
actor, contact data in a private operation and an extra operation, then verifies
restored original fixture state. Its report explicitly denies native/ride/dialer
execution and cannot replace the pending app trial.

`test:emergency-contact-identity` exercises exact server-created child identities,
fresh manager authority, stale forms/replays, races and fail-closed legacy data.
`test:emergency-contact-fixture` separately prepares actual parent/manager
verification, performs the three intended contact service operations and verifies
protected cleanup. Both require fresh isolated runtimes and accept no phone or
release proof. The native contact fixture no longer prepopulates verification.

`manual-emergency-session.mjs <private-session-path> <fresh-output-directory>`
holds that isolated fixture with interactive stdin. Submit the eight names in
`manual-emergency-checkpoints.mjs` only after observing the corresponding phone
result. After `child-saved`, `revoke-parent` performs a separately authenticated
manager service decision, not a manager UI action. This helper never saves or
removes a contact for the app. Ordered checkpoints independently verify exact
contacts/identity/revisions/operations; they cannot prove phone screens, dialer
handoff or absence of a call. `finish` requires all phases and protected-state
verification. `stop`, EOF and failure clean the fixture without claiming success.

`start-local-ui.mjs` supervises its own POSIX process group asynchronously.
Ctrl-C/SIGTERM are forwarded to that group; shutdown must verify its exit before
the private session file and copied runtime are removed. It never signals an
existing service or kills a personal process. A nonzero service failure is not
converted to a passing interruption. With a fresh absolute `SGM_LOCAL_FLOW_OUTPUT`,
`npm run test:local-ui-shutdown` starts two actual isolated sessions, one per
signal, and verifies exit codes, stopping events, removed credentials and refused
service ports. This is service-lifecycle evidence, not phone-flow evidence.

For an approved manual phone/manager team replay, keep `start-local-ui.mjs`
running and launch `manual-team-phone-session.mjs <private-session-path>
<fresh-output-directory>` in an interactive terminal with stdin kept open.
It seeds only its isolated fixture. Enter the seven names from
`manual-team-phone-checkpoints.mjs` after observing each actual UI result;
the CLI independently checks stored records/events and accepts each phase once,
in order. It does not request or decide enrollments on behalf of either UI.
Use `finish` after all seven checkpoints or `stop` for an incomplete run; both
clean the fixture. EOF also cleans up but cannot complete the run. Do not use
force-kill as normal teardown. Stop the phone/tunnel and owned services separately,
then verify that the private session file and listening ports are gone. Captures,
physical UI observations and resource cleanup need their own evidence; a passing
persisted report cannot prove them. See `phone-team-enrollment-2026-10-19/`.

Only sanitized result JSON belongs in release evidence. Keep emulators' runtime
logs and ephemeral credentials out of Git. Local evidence never automatically
accepts a physical-device or live-payment release-manifest requirement.

`test:booking-notices` requires a fresh absolute `SGM_LOCAL_FLOW_OUTPUT` and runs
actual isolated booking decisions. Owned deterministic notice-write guards test
transaction rollback, not an actual network outage. It checks all three decisions,
replays, read-state preservation, concurrent approval, scoped inbox recipients and
158 protected records/claims before destroying its runtime. No phone or push
delivery is accepted by this service-only suite.

For a one-phone team authority replay, `manual-team-authority-phone-session.mjs`
uses the same private session/output arguments and requires interactive stdin.
Observe `initial`, then use `revoke` and observe `revoked`. Use `renew` and
observe `renewed`, then `publish` and observe `new-message`. Send the exact
reply from `manual-team-authority-checkpoints.mjs` through the phone and observe
`replied`, then `finish`. Each service mutation executes once with a fresh UUID;
an unknown outcome aborts rather than retries. Renewal uses authenticated parent
and manager services, not their screens. Independent checkpoints verify the
admission boundary, unaffected parent, exact message ledger and protected records.
They cannot prove screens, simultaneous phones, notifications or release readiness.
Stop the phone/helper and destroy the owned backend separately, retaining cleanup
evidence before accepting any physical result.

For owned enrollment history use `manual-team-history-session.mjs` with the same
private session/output arguments and an interactive stdin. Its fixture creates
26 real isolated enrollment requests, approves two through a separate manager
SDK session, then revokes parental verification and deactivates only the fixture
club membership. These preparation decisions are not phone UI actions. Observe
each of the five `historyPhonePhases` before submitting its checkpoint. Only the
adult withdrawal is performed during the UI replay; reading history must not
write. `finish`, `stop` and EOF perform scoped fixture cleanup and verify that
unrelated records and global roles are unchanged. `test:team-history-phone-fixture`
exercises the fixture/checkpoints/cleanup through services only, not a phone.

The service suite requires 19 groups. `chat-post-commit-response-loss` forwards a
real authenticated local send, independently verifies its saved message and
recipient notification, then drops the HTTP reply before any response headers.
The client must observe a reset without an automatic retry. Two explicit retries
retain the original record identity/time; changed content and an outside account
remain denied. This is service transport evidence, not native composer or pending
draft recovery. The bounded loopback listener is always closed. See
`docs/release/evidence/local-chat-response-loss-2026-10-16/` for retained runs.

`team-ownership` signs in actual isolated accounts and checks that PATCH,
replacement and atomic-commit writes cannot move another club's existing team
into a manager's club. Foreign edits/deletes, non-manager and anonymous writes,
dual-club reassignment and disabled-manager edits are denied, with the complete
stored team checked after every attempt. An own-club rename remains allowed.
The separate 14-case rules suite also preserves allowed create/replace/delete
and administrator policy. These checks do not implement or prove team enrollment,
verified guardian relationships, group messaging, or identity reuse after deletion.
Original reports: `docs/release/evidence/local-team-ownership-2026-10-16/`.

The service suite now requires 24 groups, including `trip-details-ownership`,
`trip-change-parent-confirmation`, `trip-change-application` and `trip-change-supplement`.
That scenario uses authenticated local REST writes against a reserved trip with
synthetic paid metadata. It denies operational mutations, removals and an atomic
mixed title/price write, then independently checks unchanged booking/trip state
and the preserved owner-title edit. It does not implement the trip editor or
the now-approved post-reservation parent-confirmation policy. Historical
reports retain the policy state captured before that product decision; current
transport runs report implementation scope, not a product-approval assertion.

The additional proposal scenario uses four reservations belonging to two parents,
including child and synthetic paid metadata. It verifies exact-revision decisions,
parent-scoped reads, duplicate/conflicting requests, withdrawal, non-destructive
decline, guardian/payment/reservation invalidation, concurrent proposal/booking
and accept/withdraw outcomes, cancellation closure, active/orphan rides and the
atomic limit. Consent reaches `confirmed` without applying new terms or touching
payments. No editing screen, financial adjustment, final application or physical
phone flow is accepted by that consent-only scenario.

The separate application scenario applies unanimously confirmed time/route/price
through authenticated callables, using an explicitly injected synthetic route
quote provider. Independent persisted checks cover updated route/impact fields,
original invoice preservation, positive/negative balance plans, cancelled balance
closure, expired/stale quotes, guardian changes and application races. Direct
transactional payment-helper checks use synthetic provider responses/events for
attempt reuse, invoice binding, cancellation, late success, legacy intent reuse,
aged unknown attempts and proposal/checkout races. No actual adjustment, refund,
live route request, editing screen or physical-device result is accepted. See
`docs/contracts/trip-change-application.md` for the current implementation boundary.

The supplement group uses actual payment-preparation, callback and webhook
transactions with an explicitly injected synthetic provider. It starts with a
reconciled original invoice, collects two separate differences and independently
checks receipts, ledger entries, recorded money, settled balances and start
eligibility. Concurrent calls, stale/duplicate events, wrong provider responses,
lost replies, frozen fees, known-intent reuse and late success after cancellation
remain mandatory. Refunds, native checkout and live provider results are not
accepted by this scenario. See `docs/contracts/trip-change-payments.md`.

## App And Management Screens

The repeatable app suite is
`SGM_LOCAL_DISPOSABLE_EMULATOR=true npm run test:local-android-flows -- emulator-5556`
with Java 21, Node 22 and a disposable, rendering-enabled emulator already booted.
It owns the service session, private credentials, app installation, strict test
completion checks and evidence collection. Use a fresh `SGM_LOCAL_UI_OUTPUT`
directory to retain results elsewhere. Native CI runs this after the component
screen tests and uploads the dated run output. The steps below are for manual
management-site checks alongside the app.

Use a rendering-enabled Android emulator (Google APIs, not ATD). ATD can pass
semantic assertions while producing black screenshots; the capture helper now
rejects these. Use a fresh AVD or disposable data directory, not an existing live
app session. Only the `.local` app package receives the disposable credentials.

The full CI wrapper first runs `configure-disposable-android.mjs`. It requires
explicit disposable opt-in, exactly one emulator and a confirmed QEMU identity,
then disables only the Google home launcher and verifies the resulting state.
An actual launcher ANR obscured the app in run 38849678049. This setup excludes
that unrelated background component before testing, without dismissing dialogs,
retrying failed cases or suppressing system errors. Rendering and Play services
remain enabled. Home-screen/cross-app navigation is not covered by this setup;
use a separate unmodified device for those scenarios. Never use personal AVD data.

For the approved Android 15 CI device only, `SGM_BLOCK_TEST_PHONE_INSTALLS=true`
also requires `SGM_PAUSE_TEST_PHONE_STORE=true`. Setup records the actual
`no_install_apps` baseline and refuses a pre-existing prohibition rather than
clearing it. The test-only `DisposableAndroidJUnitRunner` extends AndroidX and
locks installations before starting any test. Host verification checks that the
lock is active and the map runtime is unchanged. The isolated replay builds
while locked, opens one synchronous window for its two test APKs, then re-locks
before loading its private QA session or running instrumentation. A failed
installation still attempts re-locking; a failed lock prevents the replay.

The final host cleanup verifies the guard and restores the original installation
restriction plus the original store background/stopped state, including after
failed tests. A missing guard or unsuccessful restoration fails the job. This
never disables maps/location/Play services, pauses a personal device, interrupts
an already-active installation, removes updates, or accepts physical-device
evidence. The explicit policy is not enabled in production app code.

A failed initial store pause retains its exact stage, original policy, observed
stopped/background values and separate restoration outcomes in the outer failed
device receipt. Read-only bounded process events retain only user 0 public store
process names/PIDs/types/timestamps, not hosting payloads or other applications.
An unavailable diagnostic cannot hide the initial error. No stop attempt is
retried; successful restoration cannot turn failed preparation into a successful
app trial. See `docs/release/evidence/store-pause-preparation-failure-2026-10-19/`.

The user separately approved temporary test-device administration on 19 October.
`SGM_TEST_PHONE_ADMIN_APPROVED=true` is also required. The standalone
`qa-install-guard` debug module is compiled before boot, has `testOnly=true`, no
network permission or activity, and has no release variant. Setup refuses a
physical/other-user device, an existing owner/profile owner or helper, an existing
installation prohibition, or an active installation. It installs its own helper,
requests device-owner-only mode, confirms that it is the only owner, and proves a
block/unblock round trip before app tests can start. It never resets the device
or replaces another administrator. Its single policy receiver accepts only the
installation restriction and requires the platform `DUMP` permission held by the
test shell. Ordinary app callers cannot use this receiver.

The app test runner and host use that receiver instead of the unsupported raw
`pm set-user-restriction` write. The first actual guarded run showed that the
production-style test image does not grant `MANAGE_USERS` to its shell. The
normal final cleanup always removes the test-only active admin and uninstalls
its helper, even if test or store verification fails; removal clears its policy
without needing a working application receiver. Both the owner list and package
inventory must return to empty and the installation flag to its original value.
See the official [test-only admin removal command](https://developer.android.com/tools/adb#dpm).

Instrumentation commands are sent as individual executables, with typed response
checks and a sanitized stage label on failure. Android's
[UiAutomationConnection](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/core/java/android/app/UiAutomationConnection.java)
uses `Runtime.exec(command)`, not an interactive shell: do not append exit-marker
commands, pipes or command separators to a `UiAutomation` request.

Before attempting device ownership once, setup waits read-only (at most 90 seconds)
for Android's boot account-compatibility calculation to finish and verifies zero
accounts. Account counts are filtered on-device; names and authentication records
are not collected. An unfinished calculation can return the same provisioning
error as a real account conflict. Existing accounts, an unavailable count or an
unready policy service stop setup: no account is removed, no device is reset and
provisioning is not retried. The store is already paused while waiting. Setup
failures retain typed cleanup receipts without becoming successful trials.
See [DevicePolicyManagerService](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/services/devicepolicy/java/com/android/server/devicepolicy/DevicePolicyManagerService.java).

Android 15 checks `DISALLOW_INSTALL_APPS` before admitting even ADB installation
sessions, so keeping that restriction enabled while asking Gradle to install its
test APK would prevent the test setup itself. The sequence above is intentional:
[PackageInstallerService](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/services/core/java/com/android/server/pm/PackageInstallerService.java),
[PackageManagerShellCommand](https://android.googlesource.com/platform/frameworks/base/+/android-15.0.0_r1/services/core/java/com/android/server/pm/PackageManagerShellCommand.java).

The network replay records `initialNetwork` before checking its original radio,
connection and backend prerequisites, and before either transport request starts.
The observation includes the actual Wi-Fi/data flags, SIM/default-data summary,
context-user unlock state and the two platform setup settings. No subscriber,
phone or authentication identifiers are collected. These settings are read only:
the observer does not complete setup, enable a radio or retry the scenario.
Constructor failures now use `network-preconditions`, not `booking-picker`.
`network-start-evidence.mjs` requires the versioned initial observation for newly
completed replays, in addition to the unchanged handover/offline/recovery checks.
Historical successful receipts retain their original dated validation contracts.
Six Android instrumentation cases cover record-before-refusal, recording errors
and mutation isolation; local Node contracts run with
`node --test tests/network-start-observation.test.mjs`.

The ride case needs a Google APIs image with functioning Play services. It grants
permissions only to `.local`, then injects a synthetic location through the
official fused-location mock API. Mock positions affect the entire emulator:
the explicit disposable-device opt-in is mandatory. Never use a device with
real accounts, active production apps, or personal location sessions.
The mock permission is declared only in the emulator-specific debug manifest,
not ordinary debug or release builds. No production location provider is replaced.

After the separate-process theme check, `LocalRideFlowTest` starts a ride through
the real app, confirms each passenger, completes it, checks impact/reward screens,
and signs in as the parent to submit a review. The runner independently verifies
the completed trip/bookings, four audit events, one pair of ledger records and
one rating in the local database before accepting UI evidence. These synthetic
positions and pre-granted permissions do not prove physical GPS or permission UX.

`LocalChatFlowTest` then uses the parent and driver logins to exchange replies,
checks draft retention across navigation/recreation/rotation, and loads a seeded
120-message history with timestamp ties. A separately authenticated local SDK
peer sends one message while the parent thread stays open; this is not a claim
of two physical phones or push delivery. An unrelated synthetic account cannot
open the thread. Independent stored-message, recipient notification and unread
checks must pass before the runner writes its result. The current suite requires
21 instrumentation cases and records 22 coverage groups; these are not the same
count. Older evidence retains the exact counts of its original run.

`LocalTripCancellationFlowTest` uses the actual app and authenticated SDK to keep,
then cancel a driver's trip. Portrait review, landscape confirmation, cancelled
history, the parent's two closed reservations and pending-refund display are
checked. The host independently verifies the durable receipt, restored offered
capacity, one stored notice and denial of booking/approval/start afterward. Paid
metadata is synthetic; no charge, refund settlement or production data is used.

`LocalChatNetworkFlowTest` disables Wi-Fi and mobile data on the explicitly
disposable emulator, requires no active internet network and a failed TCP probe
to the isolated backend, then sends through the actual app. An unconfirmed send
must retain its draft and retry action. Restoring the original network settings
allows an explicit retry; a separate database check requires exactly two messages
and matching read notifications after the reply. A real account switch must not
inherit the other account's unsent draft. Both test and host cleanup restore the
original network settings. This does not cover disconnection after a server commit,
process restart, expired credentials, physical phones or push delivery.
The baseline uses actual Wi-Fi/default-subscription data APIs, not legacy global
setting keys. It is saved with the run ID before changing either transport. Host
cleanup rejects stale/ambiguous baselines; failed disconnections retain their
observed network state before restoration. No offline result is accepted unless
the actual network and endpoint checks both pass.

`LocalChatProcessRestartTest` adds two method-selected instrumentation stages
around a host-issued force-stop of the local-only app. The first signs in and
sends one message through the app; an independent database checkpoint confirms
that exact message and request ID before the process boundary. The host checks
the disposable device, local app session and same-run receipt before stopping
the app, confirms no app process remains, and never clears app data or credentials.
The resume stage must have a different process ID, reach the signed-in home
without logging in, reopen the confirmed history and send a new message. The
driver replies through the app, then the parent reads it. Final persisted checks
require three unique messages, three addressed/read notifications, unchanged
original message identity/time and zero unread count for both actors. Receipts
and captures are collected after both stages. The network-disruption case runs
last, after independent restart verification, so a missing device subscription
cannot prevent the unrelated restart stages from running. Its checks remain
mandatory, and evidence collection remains pending until that final case ends;
neither an earlier capture pull nor a restart pass proves a complete suite.
This is a confirmed-message cold-start test, not activity recreation or proof
that pending/unsent drafts survive force-stop. It does not close physical-device,
token-expiry, post-commit acknowledgement-loss or push requirements. Compilation
and configuration checks alone do not accept this app flow. The completed
nineteen-case replay and unchanged stage/persisted artifacts are retained in
`docs/release/evidence/local-chat-restart-2026-10-16/`; pending drafts and physical
devices remain outside that evidence.

`LocalChatResponseLossTest` hosts the production conversation route and real SDK
gateway in a test activity. A supervised child HTTP proxy forwards only the three
chat callables to the isolated demo project. The test pauses Firestore networking
after opening the empty conversation so its independent acknowledgement cannot
hide a lost callable reply. Every first-phase send reaches the actual service;
the worker independently checks exactly one stored message and one addressed
notification before discarding the response. A separately selected second phase
returns a controlled 429 rejection without forwarding it. The final phase returns
the real service acknowledgement. The composer must retain its draft and original
request identity through both failures, then clear on confirmation. Networking is
restored and exactly one bubble appears. The host verifies the same saved message,
timestamp, request ID and notification after all attempts. The child has its own
event loop because the host runs instrumentation synchronously. It is closed in
cleanup. This is controlled transport/SDK evidence, not OS-network interruption,
full-app navigation, physical-device, pending-draft restart or push evidence.
The independent OS-network scenario remains mandatory and runs last.

`LocalMembershipFlowTest` requests two new club memberships through the app,
then uses a separate authenticated local manager SDK session to approve/refuse
them. The parent explicitly refreshes, re-requests the refused membership, sees
its later approval after activity recreation, then signs in as another account.
`verifyNativeMembershipUi` independently checks both active member records, three
matching audits/notifications, exact counters and unchanged global roles. Manager
decisions in this case are SDK calls, not a claim of native management controls.
`GroupsLayoutTest` separately covers loading/error boundaries and a 320dp layout
with 1.3x text. No phone, push or broad club-discovery evidence is inferred.

Conversation deployment requires the new message composite index and updated
`sendChatMessage`, `getChatConversation`, `markChatMessagesRead` callables before
shipping the Android client. They are checked in, not deployed by local tests.
New Android sends always supply a UUID; retries with the same identity/content
create one message and its recipient notifications in one transaction. Existing
keyless callers retain their prior API but do not gain retry deduplication.
Read acknowledgements cover only explicit visible message IDs. Legacy random
notification IDs are not guessed or cleared. Thread history is paginated, while
the existing inbox still discovers conversations from only its latest 50 messages.
There is no offline send queue, fabricated delivery state, device push proof or
iOS conversation implementation in this change.
The Messages picker can start an exchange for an accessible reservation; its
first-message and archived-directory evidence remains separately scoped.

Ride lifecycle deployment requires the checked-in Firestore rules and indexes
before the new app queries run, followed by the updated callables. The trip's
server-owned `activeRideSessionId` serializes starts and prevents booking changes
after departure. Existing active sessions created without that lock must be
explicitly resumed/reconciled before another start; no silent migration is added.
Completion closes the trip and all approved attached bookings together. Production
deployment and index readiness are not established by local emulator tests.

Start the guarded services in a terminal, supplying a fresh absolute private path:

```sh
SGM_LOCAL_UI_SESSION_FILE=/private/tmp/sgm-local-session.json node scripts/qa/start-local-ui.mjs
```

This uses the same credential-free, egress-restricted runtime as the API suite,
seeds synthetic parent/driver/club accounts and adds a local-only administrator.
It keeps running for screen checks. No cloud account or role is modified.

In another terminal, build/install the debug app with
`-PSGM_USE_FIREBASE_EMULATOR=true`. Then transfer the session directly to its
private sandbox, without printing it or putting its password in process arguments:

```sh
node scripts/qa/install-local-ui-session.mjs emulator-5556 /private/tmp/sgm-local-session.json
```

Run `:app:connectedDebugAndroidTest` with the same local flag and instrumentation
class argument selecting `LocalAppFlowTest`, `LocalLandscapeLoginTest`,
`LocalDriverFlowTest` and `LocalUiRegressionTest` in the
`be.sportgreenmoove.app.ui` package. Retain the Gradle JUnit reports; a bare
`adb am instrument` exit code alone does not prove success. The driver test
requires the freshly seeded pending booking; reseed before a second full run.
The app tests skip routine non-local builds before launching an activity.
Run `LocalThemeRestartTest` in a separate instrumentation invocation afterwards
to verify that the saved dark theme is restored in a fresh app process, not just
after activity recreation.

For management screens, run
`VITE_USE_FIREBASE_EMULATOR=true npm run dev --workspace admin`.
Local mode supplies a demo configuration and refuses production builds.
Use only the ephemeral local admin from the private session file.

Stop the test session, remove its private credential file if interruption prevented
cleanup, and stop the disposable device when done. Never commit runtime logs or
credential-entry screenshots. Captures under the local app's external-files
`local-ui-evidence` directory contain only explicitly captured test states.
