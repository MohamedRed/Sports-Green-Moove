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
checks must pass before the runner writes its eight-case/nine-group result.

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
