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

Only sanitized result JSON belongs in release evidence. Keep emulators' runtime
logs and ephemeral credentials out of Git. Local evidence never automatically
accepts a physical-device or live-payment release-manifest requirement.

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

The service suite now requires 22 groups, including `trip-details-ownership` and
`trip-change-parent-confirmation`.
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
phone flow is accepted by this service evidence.

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
