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
