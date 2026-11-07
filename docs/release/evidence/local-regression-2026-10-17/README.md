# Current-Source Local Service Regression

- Source: `6c787e2bad8c3a8d73f9eb0cd8ae55ca377b2046`.
- Command: `npm run test:local-flows` with Java 21 and a fresh evidence output.
- Completed: `2026-10-17T21:35:44.144Z`; process exit 0.
- Run: `dc263a88f6492d86b7fc769cda4c9ba9`.
- Result: 24/24 local service groups passed. `services.json` is the original
  output, copied unchanged; `sha256.json` records its byte count and digest.

The isolated demo environment used fresh accounts and records. The runner strips
cloud credentials, disables real provider secrets and guards outbound requests.
It completed shutdown of its local services. No production data or paid staging
resource was created.

The replay includes booking requests/decisions/cancellation and capacity races,
ride lifecycle and ledgers, messages/read state/reply-loss recovery, club review,
team ownership, parent-confirmed changes, application and supplement receipts.
Payment and route service scenarios use their existing explicit synthetic
providers. This is a regression run of implemented services, not 24 new user
flows, native UI, physical tracking, live route computation, real charges/refunds
or team-conversation proof. In particular it does not establish the separate
confirmed-consent process-restart screen case.

The root configuration/evidence checks also passed: 338 checks, zero failures.
Those checks are not additional user-flow executions. Required real-device,
emergency-action and safety-audit evidence remains open in the release manifest.
