# Temporary Network Startup Observation

The user approved one temporary startup-logging trial on a disposable simulated
phone on 2 November 2026. This is a diagnostic, not a network repair, a chat pass,
an app installation, a physical-device result or release acceptance.

Use the registered `android-transport-probe.yml` entry point with explicit
`network_startup=true` on the reviewed branch. Its ordinary transport diagnostic
stays unchanged for pull requests and ordinary dispatches. The opt-in instead
calls the separate `network-startup-logging.yml` workflow, on one API-35 Pixel-6
disposable image. It does not run the transport experiment or the full app matrix.

The observer requires an ephemeral GitHub-hosted Linux runner, three explicit disposable/approval flags, an emulator serial,
API 35, x86-64, user zero and absence of all app/test-administration packages.
Only `persist.log.tag.MultiSimSettingController` is temporarily changed to `D`.
One restart captures decisions that happen during startup; a changed boot identity
and completed boot are verified without retaining either boot identifier.

Three bounded samples collect the existing sanitized modem, subscription,
selection-history and carrier-loader summaries. The raw OS dumps, subscription
identifiers, account data and request contents are never written. No radio,
network routing, browser security, app settings or production resource is changed.

Normal completion, collection failure and cancellation all attempt to restore the
exact original property and verify app absence. A failed restoration fails the
diagnostic. Retain `restoration.json` and the original artifact even on failure;
do not infer restoration from the host job or device shutdown alone. Abrupt host
loss or uncatchable process termination remains an unverified-cleanup outcome.

The diagnostic still cannot prove the root cause merely because a controller event
is absent. Do not repeat it, promote a pass or use it as an automatic retry without
reviewing its actual result and obtaining approval for another trial when needed.

Web Integration Smoke adds one device-free contract test. Its 153 pre-existing
commands and 19 uploads remain byte-identical; only the new test is excluded from
the historical fingerprint and is independently checked by exact command.
