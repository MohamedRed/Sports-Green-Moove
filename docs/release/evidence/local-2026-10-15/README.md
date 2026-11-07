# Isolated Local Service Flows - 15 October 2026

## Scope And Result

Nine scenario groups plus fixture setup passed against actual callable handlers,
Firebase Auth, Firestore and Realtime Database emulators. This is service/API
integration evidence, **not phone UI, physical tracking or live provider evidence**.
`results.json` is the sanitized output of the completed run. Fixture IDs and
amounts describe disposable local records only, not real people or money.

Application Functions source is unchanged from `99651d7`. The accompanying
commit contains the hardened harness, its tests, and this evidence. Node 22,
Java 21 and the repository-pinned Firebase CLI were used.

| Group | Observations |
| --- | --- |
| Publication | Verified driver publishes; parent lists the result; parent publication, invalid capacity and unauthenticated listing are rejected. |
| Booking and cancellation | Guardian requests; driver approves; seats decrement; parent cancels; seats return once. Pending cancellation also preserves capacity. Wrong-role approval, third-party cancellation, non-guardian child booking and self-booking are rejected. |
| Last-seat concurrency | Two requested bookings race for the last seat. Exactly one approval succeeds; the other is rejected and capacity remains zero. |
| Messages and notifications | Parent and driver exchange messages; both inboxes expose the conversation preview and recipient notification. Outsider messaging and empty text are rejected; outsider inbox has no conversation. This is not device push delivery. |
| Ride lifecycle | Approved booking starts; parent retrieves active ride; pickup and drop-off persist; ride, booking and RTDB metadata finish as completed. |
| Audit and ledgers | Two local manual audit records; one impact and reward ledger entry. Repeated completion and pickup after completion are rejected. Active ride disappears after completion. |
| Ratings | Parent rating persists; duplicate and outsider rating rejected; review prompt disappears. |
| Club request | Outsider membership request persists; repetition reuses the same request; missing club rejected. Approval/rejection were not tested. |
| Support | Report persists as open with the correct author; empty description and unauthorized review rejected. Authorized support handling was not tested. |

The payment attempt was intentionally blocked by the missing local connected
account. This confirms that precondition only. No payment intent, checkout,
onboarding, refund or payout is accepted as tested.

## Isolation And Reproduction

```sh
npm run test:local-flow-isolation
SGM_LOCAL_FLOW_OUTPUT=/absolute/path/results.json npm run test:local-flows
```

Java 21 must be available through `JAVA_HOME`/`PATH`. The runner builds Functions
and copies the build into a disposable directory; it does not edit production
application code. It uses only `demo-sgm-local-qa` and fixed loopback endpoints.
Credential environment variables are not inherited, CLI configuration is
isolated, and the fixture password is generated per run and not printed.

The copied Functions entrypoint loads a local-only HTTP/fetch/HTTP2 egress guard.
Provider secret overrides are explicit disabled sentinels, not real keys or mock
successes. No external provider service is called. The wrapper rejects stale
output and incomplete scenarios, shuts emulators down and removes its temporary
files. `web-integration-smoke.yml` repeats the isolation and scenario checks.

## Remaining Scope

- All corresponding phone screens and interactions, including two-device sync.
- Trip editing/cancellation; explicit booking refusal; club approval/rejection;
  authorized support processing; recipient device push delivery.
- Provider-backed search routing, real payment/onboarding/refund/payout flows.
- Guardian consent collection; physical GPS/background/locked-screen/network-loss
  tracking and the other required device scenarios.
- Real-run safety audit and payment reconciliation evidence.

The release manifest is unchanged. Local manual audit records do not replace
required real-run safety evidence. No new app recordings or screenshots were
generated for these API checks; the partner site displays dated local results,
and labels retained historical captures with their actual earlier date.
