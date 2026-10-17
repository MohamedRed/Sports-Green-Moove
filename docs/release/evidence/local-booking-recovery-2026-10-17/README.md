# Booking Response Loss — 17 October 2026

Isolated synthetic fixtures only. No production deployment, real charge/refund,
physical tracking acceptance or new app recording is claimed. Original recordings
and captions on the private site keep their earlier dates and scope.

## Reproduced Failure

`before.json` records run `6be3428f9893016cd4a6498b54042674` at 05:30:54 UTC,
using the actual compiled `9f2cb373e0412414d0630c789134c7b86db418d2` booking
handler (source SHA-256 hashes are embedded). **5/10 checks passed**.

The proxy first forwarded the authenticated request and independently verified
the stored booking, child, parent, two seats and timestamp. Only then did it
discard the successful response. The caller received `ECONNRESET` and no HTTP
response. There was no automatic transport retry.

Two explicit identical retries, including the same supplied `clientRequestId`,
created three bookings instead of recovering one. Replays after approval and
cancellation created fourth and fifth records. Reusing that identity for three
seats was also accepted, creating a sixth. The original cancelled booking stayed
closed and capacity remained consistent; this does not mean duplicate requests
were safe. No duplicate charge is inferred because no payment was attempted.

## Corrected Local Transport

`after.json` records run `af54f39a3322292fb8f25c27e8b4f131` at 05:45:21 UTC,
with current source hashes. **10/10 checks passed**, plus **13** separate identity
and resolution scenarios. The response is discarded at the same independently
verified post-commit boundary. Every identical retry recovers the original
booking ID and timestamp. Approval and cancellation retain one booking and the
correct capacity. A changed payload reusing the ID receives `ALREADY_EXISTS`.
Replays expose current booking status, without reopening a closed booking.

The additional scenarios include simultaneous identical/conflicting sends, an
abandonment fence denying a late send, resolution that preserves a committed
booking, eight send/resolution overlaps, invalid identities, and an authentication
account mismatch. Each overlap has one consistent committed-or-abandoned result.
These thirteen cases were not run against the earlier ten-case baseline.

## Native And Rule Contracts

- `android-coordinator.xml`: **10** executed JVM tests. A recreated gateway keeps
  its operation after an uncertain response; changed selections resolve the old
  operation first; malformed acknowledgements and account changes retain pending
  state; storage failure blocks submission; closed bookings do not look newly sent.
- `swift-recovery.json`: **14** Foundation checks compiled as Swift 6, including
  a separate write process and recovery process using the actual app store and
  coordinator. Typed trip/child/seat details and the same UUID survive process exit.
  This is not the Firebase iOS SDK, iOS UI, device or OS-background evidence.
- `functions.json`: **238/238** unit tests passed.
- `services.json`: **24/24** wider isolated service scenarios passed again.
- `displayed-agreement.json`: **25/25** displayed-snapshot regression cases;
  `transaction-consistency.json`: **14/14** guardian and transaction-retry cases.
- `rules.json`: **20/20** direct receipt-access denials passed for signed-out,
  parent, driver and administrator client contexts. No Firestore rule permissions
  were broadened. The new server-only collection needs no custom query index.
- Android unit tests, instrumentation compilation and the host Swift package
  build passed. The host package excludes Firebase SDK branches.

Native CI now requires a two-stage SDK test: independently commit and discard a
booking response, preserve the private pending identity, stop only the validated
disposable app, recover in a different process and verify exactly one persisted
booking and receipt. Its stage is named `booking-post-commit-response-loss-sdk`,
not a parent-tap UI test. The fresh CI artifact, not compilation or this test's
presence, must prove its actual execution. No such artifact is included in the
local receipts above.

## Protocol And Remaining Work

See [the recovery contract](../../../contracts/booking-request-recovery.md).
Server creation and receipt are atomic. Both native gateways retain durable,
account-scoped identities; changed uncertain selections are resolved or fenced,
never silently substituted. Invalid storage is not reset as a fallback. A receipt
acknowledges the original submission and does not authorize new terms or money.
All API/client changes require coordinated release and remain undeployed.

Physical-phone retries, actual iOS SDK/recovery, interactive parent recovery UX,
the driver-edit and parent-confirmation screens, refunds and real safety-audit
evidence remain unfinished. The earlier intermittent mobile-subscription setup
failure is not fixed or hidden by this work. The release goal stays active.

Web Integration Smoke runs fresh transport/race and Swift recovery checks and
uploads `booking-recovery-results`. Retained failures are byte-pinned by
`tests/booking-recovery-evidence.test.mjs`; historical reports remain unchanged.
