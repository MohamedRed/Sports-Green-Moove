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

Use the signed official BrowserStack Local desktop helper and enter the existing
key privately in its own console. Before connecting, choose No proxy, enable
advanced flags and use `--only` with exactly `isolatedLocalAllowlist` from
`scripts/qa/browserstack-local-policy.mjs`, plus `--timeout 10`. Never use
`--force-local`: it overrides the allowlist. Do not enable folder access, verbose
logs, API logs, MITM proxy or extra hosts. Read back the active console's Only
Allow and all these switches, and validate with `assertIsolatedTunnelSettings`.
Only ports 5001, 8080, 9000 and 9099 on `127.0.0.1` and `localhost` are approved.

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
