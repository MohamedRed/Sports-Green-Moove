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

The repeatable app suite is `npm run test:local-android-flows -- emulator-5556`
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
