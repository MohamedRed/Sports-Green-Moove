# Isolated App Live Phone Checks

Use the existing subscribed App Live plan. App Automate/Espresso is a different
product and is not required or assumed available. Never change plans, connect a
production APK or relax the demo-project and loopback guards for this workflow.
No cloud infrastructure was provisioned; no Terraform change is required.

## Prepare

Use Node 22 and Java 21, with Java 21's `bin` directory before the system Java
in `PATH`. The service runner removes inherited cloud credentials, binds only
loopback, disables live providers, generates private ephemeral fixture credentials
and closes the session on termination:

```bash
SGM_LOCAL_UI_SESSION_FILE=/private/tmp/sgm-phone-session-FRESH.json node scripts/qa/start-local-ui.mjs
```

Wait for the ready message. Do not print the private JSON or capture credential
entry. Build in another terminal with `ANDROID_HOME` configured:

```bash
android/gradlew -p android :app:assembleDebug -PSGM_USE_FIREBASE_EMULATOR=true -PSGM_FIREBASE_EMULATOR_HOST=127.0.0.1 --no-daemon --max-workers=2
```

Verify the resulting package is `be.sportgreenmoove.app.local`, host is
`127.0.0.1` and project is `demo-sgm-local-qa`. Record the source commit and APK
SHA-256 before upload. This default build has no live map-display key; do not
use it to accept map rendering, provider routing or tracking.

## Connect Privately

Use the signed official vendor binary with the scoped macOS launcher:

```bash
node scripts/qa/start-scoped-browserstack-local.mjs /private/tmp/sgm-browserstack-local-vendor/BrowserStackLocal
```

The launcher verifies the publisher, creates an owner-only temporary directory
and a 0600 named pipe, and prints only that pipe path and the public restrictions.
An authorized operator transfers the existing key as one in-memory line into
that private pipe, without printing it or entering it in a terminal. The worker
passes a key-only YAML document through a second owner-only named pipe to the
vendor's `--config-file`; no regular plaintext credential file, command argument or
environment variable is created by the launcher. Raw provider output is suppressed.
The credential input has a three-minute deadline, the private vendor transfer
has a fifteen-second deadline, and there is no automatic authentication retry.
The signed v8.9 binary rejected `/dev/fd/3`; a fictional-key probe confirmed the
named-pipe configuration reaches credential validation. This is not a successful
connection or phone-flow result.

All non-secret restrictions are fixed command arguments before authentication:
`--only` is exactly `isolatedLocalAllowlist` from
`scripts/qa/browserstack-local-policy.mjs`, with `--timeout 10`, request logging
disabled and the local configuration dashboard disabled. No folder, proxy,
MITM, extra-host, force-local or daemon flag is allowed. A process-start receipt
is not connection proof: require the phone toolbar's active local connection.
Stop only this launcher's process group with SIGINT after the trial and require
its cleanup acknowledgement; do not kill other local helpers.

For browser-controlled input, start `node scripts/qa/private-credential-form.mjs`
with the launcher's actual pipe path. It serves one password input on a fresh
loopback-only port, outside the phone tunnel. Read the existing account key into
session memory, mask its account field again, and fill the local form without
emitting accessibility values, clipboard contents or screenshots during entry.
Use a freshly resolved submit control, not an index retained from before filling.
The form clears its field before sending one same-origin JSON request, delivers
one bounded line into the existing 0600 FIFO, and closes on delivery or expiry.
Host/Origin/content-type checks and CSP reject cross-site submission and framing.
No key is logged, echoed, saved in a regular file, or passed in process arguments
or environment variables by this input helper. Verify the field is empty and
the listener has closed, then close only the input tab created for this trial.
This prepares authentication; it does not prove a connected phone or user flow.

Only ports 5001, 8080, 9000 and 9099 on `127.0.0.1` and `localhost` are approved.
The separate `--child-invitation-signup-approved` launcher option adds only port
4185 on those same two loopback hosts. Use it only for an explicitly approved
invitation-page trial, then stop that connection; it never changes the default
four-service scope. It cannot be combined with the startup-diagnostic option.
No other hostname, port, force-local mode, workspace folder or request logging
is enabled. The 30 October trial reached an enabled Local toolbar but Android
Chrome refused both loopback page addresses before the form. Its helper later
exited without a requested stop, with no close timestamp proving when. Preserve
that incomplete result separately from application defects or a working browser
connection. No signup or approval occurred. See
`evidence/invitation-phone-connection-2026-10-30/README.md`.

`start-child-invitation-browser.mjs` accepts an optional private phone-session
path outside its evidence output in an owner-only directory. Its temporary signup
input is never exported; the post-creation handoff requires the actual isolated
child UID, exact child-only roles and no existing parent link. This post-creation
branch was not exercised by the failed phone connection. Both private paths are
removed on verified runtime disposal. Do not collect them as evidence.

The 21 October scoped launch reached App Live's active local-testing toolbar,
installed the pinned isolated team-chat APK and signed in the synthetic parent.
Its first independent conversation checkpoint failed because the new controller
assumed ascending service order. No team-chat phone flow was accepted. The
controller now validates exact sequence, actor, admission boundary and message
identity independent of page order. A fresh end-to-end phone trial is still required.
The phone session ended, owned helper group stopped, both handoff directories
were removed, the private fixture session was removed and all four ports refused
connections. No temporary device administrator or installation blocker was used.

The local console's initial Connect action can start a tunnel immediately.
Its approved allowlist must already be configured before authentication; do not
bootstrap an unrestricted connection to reach its settings. If the initial
configuration cannot be verified, stop preparation before starting the backend
or phone. A connected status alone is not evidence of the approved scope.

Credential entry is not safely masked by every accessibility implementation.
While a credential input may still exist, never emit a raw accessibility tree,
DOM snapshot, screenshot or selector diagnostic containing its value. Use
non-emitting observations and redact credential text before returning any
diagnostic; a click completing does not prove the credential form disappeared.
Do not copy keys through an unverified clipboard operation. Retrieve existing
credentials in memory only, hide the account value again, restore any previous
clipboard and clear temporary credential variables after use. Replace exposed
credentials before resuming. The 21 October replacement and cleanup are retained
in `evidence/browserstack-key-rotation-2026-10-21/README.md`.

Chrome may need the testing site's Apps on device permission to detect its local
helper. Refresh only the relevant page after permission is enabled. Do not
restart Chrome or alter unrelated sites. The phone toolbar must show its local
connection, not merely a connected helper console.

Upload only the isolated APK and start a real Android device. A synthetic
`phone-...@example.test` parent can sign up through this private connection;
do not grant privileged roles or impersonate actual users. The fixture driver
already exists in the isolated data. Its authenticated service action is not
native driver UI evidence. Use the app's clipboard paste for exact email entry
if remote key events enter `2` for `@`; verify the address before submitting.

## Capture And Verify

Retain the native device screenshots at each observed state before advancing.
The screenshot control opens a macOS Save As dialog; completing that dialog is
part of saving, and a pending dialog is not a failed download to retry.
Keep original PNGs unchanged. Do not record or retain password entry.

For team-draft testing, start the ordered independent record controller after
the owned backend is ready, using a fresh output directory:

```bash
node scripts/qa/manual-team-draft-phone-session.mjs /private/tmp/sgm-phone-session-FRESH.json /private/tmp/sgm-team-draft-records-FRESH
```

For team unread counts, use a fresh environment and the separate controller:

```bash
node scripts/qa/manual-team-read-phone-session.mjs /private/tmp/sgm-phone-session-FRESH.json /private/tmp/sgm-team-read-records-FRESH
```

Observe and capture `initial-unread`, open the parent thread for `parent-read`,
then leave the thread before `publish`. This single isolated driver service send
must not be retried on an unknown outcome. Capture `new-unread`, open the parent
thread for `parent-read-again`, and explicitly send `Reçu sans doublon QA` from
the phone for `parent-sent`. Switch to the driver account without opening its
thread for `driver-unread`, then open it for `driver-read`. Return to the parent
directory for `parent-returned` and enter `finish`. The controller never marks
reads or sends the parent reply. It requires exact per-account counts, private
receipt identities/timestamps, admission-limited history, one send operation per
message and the protected baseline at every stage. Its records alone do not
prove phone UI, notifications or simultaneous/inter-phone exchanges. Save the
independent original phone exports separately and verify environment disposal.

Capture actual phone states before entering `before`, `unsent`, `reopened`,
`sent`, `cleared`, `other-account`, then `finish`. Only the app sends the parent
message. This controller seeds through authenticated isolated service actions,
reads the separate driver's view and checks stored records; it cannot prove
phone UI, process death, notifications or environment destruction. Its final
report remains incomplete on any error or early stop. Independently stop and
verify destruction of its owned local environment even after a controller error.

For the parent one-seat/free-booking scenario, collect an independent checkpoint:

```bash
node scripts/qa/browserstack-parent-booking-receipt.mjs /private/tmp/sgm-phone-session-FRESH.json phone-FIXTURE@example.test requested /private/tmp/phone-requested-FRESH.json
```

The email must be lowercase and match the actual synthetic account. After a
separate authenticated driver's approval command has completed, collect
`approved`, refresh the parent screen and capture its actual approved state.
Then cancel and confirm from the parent's phone, observe the result, capture it
and collect `cancelled`. Each output path must be fresh. Never retry an approval
action on an unknown outcome. The checkpoints require one booking/receipt,
four-to-three-to-four capacity, distinct actors, no payment metadata and the
actual parent cancellation identity. Join them with
`assertParentPhoneBooking`; retain bounded scope, raw receipts and hashes.

If recording fails at screen-sharing permission, report no new video. Existing
permission failures do not authorize restarting the browser or weakening its
security. Screenshots remain useful evidence but do not replace unrecorded steps.

Stop the phone session, disconnect the helper and confirm Disconnected, stop
the helper processes owned by this run, terminate the local service session and
verify its private session file was removed. Keep the release manifest unchanged
unless the exact required scenario has actually been proven. One parent phone
plus a driver API call does not prove two phones, driver UI, child/guardian flows,
payments/refunds, maps, GPS tracking or iOS.
