# Production release preflight · 16 November 2026

The production backend was checked against the compiled candidate
`6b70a882c2ac9a777412e060041b6598b009d3ab` using read-only Google Cloud APIs.
No account, ride, notification, payment or deployment was created.

- Cloud Functions reported 31 active endpoints. The compiled candidate declares
  101. Independent HTTPS GETs returned 404 for reservation listing and emergency
  contact lookup. Existing callables such as profile initialization and active
  ride lookup returned the expected invalid-method callable responses.
- The published Firestore policy differs from the candidate's canonical policy.
  Read access for booking and ride chat therefore still requires a reviewed
  [rules release](../../../../infra/firestore-rules/README.md) and device verification.
- The urgent email trigger declares two production secrets that do not exist in
  Secret Manager. The [support contract](../../../contracts/support-urgent.md)
  describes the sender and provider prerequisites.

The App Live upload workflow requires a verified backend before distributing
the production-connected APK. This comparison does not satisfy that gate.
The separately documented isolated App Live workflow can still exercise
synthetic scenarios within its approved scope. Neither path has supplied the
remaining physical tracking, emergency handoff, operational notification or
safety audit evidence required by the [release protocol](../../real-device-test-protocol.md).
