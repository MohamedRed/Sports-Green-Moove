# Controlled Approval / Cancellation Conflict

Date: 2026-10-17. Isolated project: `demo-sgm-local-qa`.
This is local service evidence, not phone UI or production-provider evidence.
No production deployment, payment, refund or real-user mutation occurred.

## Reproduction And Cause

The initial business source is commit
`4b2c61f8dc3078fb5e528c6fe3d550bd4897f1dd`.
The earlier CI failure remains retained in
`docs/release/evidence/local-session-restoration-2026-10-16/screen-recheck/README.md`.
The controller holds cancellation after its trip read, then starts approval of
the same requested booking. The production callable handler and cancellation
service execute against the real local database. The controller does not replace
their responses, change database concurrency mode or accept INTERNAL as success.
Its watchdog fails the test if the overlap was not established.

`before.json`, run `719c96e0834ae3e85a56eb98c881b76a`, retains the failed result.
The RPC observer records only
method, operation and status; it never reads headers or records credentials.
The query first returned `10 ABORTED: Transaction lock timeout.`. Legacy streaming
then replayed the same transaction query and received `3 INVALID_ARGUMENT:
Transaction is invalid or closed.` twice. The business transaction received only
the latter error. The accompanying original emulator log independently records
the timeout followed by attempts to reuse the closed transaction.

A trip-first approval experiment initially passed but failed when repeated.
`rejected-ordering-experiment.log` is the original failed transcript, not a
complete result receipt. That candidate was removed; no ordering change remains
in the accepted business handler. It is not counted as successful evidence.

## Fix And Controlled Verification

The shared primary client enables the installed SDK's supported
`gaxServerStreamingRetries` setting before first use. This preserves status-aware
transport behavior, so ABORTED reaches the existing bounded transaction runner
instead of replaying an invalid query token. No application retry loop, fallback,
transport change, new provider, timeout increase or accepted error code was added.

`after.json`, run `8e1661cc834fc688b6d98a1399363cab`, retains twelve distinct
controlled overlaps. Every case has exactly
one successful reviewed operation, only an explicit domain conflict for its
loser, consistent booking/trip status and seat count, one parent notice and the
appropriate cancellation receipt presence. Both cancellation and approval win
in this run. Six query-abort recoveries restart the full transaction; none returns
INVALID_ARGUMENT. The before/after booking-handler source hashes are identical.
The JSON also pins the changed client configuration source.

The installed transport contract tests separately reproduce legacy ABORTED replay,
require single-attempt propagation of ABORTED, INVALID_ARGUMENT, PERMISSION_DENIED
and NOT_FOUND, and preserve bounded configured UNAVAILABLE handling. The shared
client initialization has an executed unit test. CI runs the transport contracts
and controlled overlaps, and retains new traces even when they fail.

The first broader suite run failed (19/24 groups) because fixture helpers had used
the shared client before importing its configuration. Its original result is
`services-bootstrap-failure.json`; it is not a successful suite. The fixture and
local client entry points now initialize the same primary client before use.
The chat-index failure in that run followed the failed fixture preparation.

The corrected bootstrap run `ea6efa36c6d80e12eec00830189944ac`, at
`2026-10-17T02:52:37.395Z`, passed all 24 groups (`services.json`). This includes
the HTTP-authenticated cancellation races, last-seat decisions, trip changes,
payment/proposal fence, synthetic supplements, receipt idempotency and retained
refund-pending state. It does not prove a live payment or refund.

The separate synthetic payment reconciliation regression passes all fourteen
cases (`payments.json`), including payment-first, cancellation-first, concurrent
delivery, immutable invoice/ledger preservation and late success/refund state.
The Functions suite passes 190 tests in 34 files; the seven installed streaming
policy tests also pass. Existing webhook and race assertions were not relaxed.

Web Integration Smoke covers the new scripts, source, immutable evidence and
executed conflict checks. No infrastructure or Terraform change is needed.

A final twelve-overlap run with the corrected shared bootstrap also passes:
`c246598f3a4cc48d3b65a46cf1de8713`, `2026-10-17T02:55:23.029Z`
(`recheck.json`). It preserves the same business/configuration hashes, observes
five ABORTED transport statuses and no closed-token errors. The explicit nested
artifact directory and cleanup path were executed successfully.

## Scope Still Open

This proves the observed local streaming conflict path, not every concurrency
interleaving in production. Review of shared transaction read ordering and stale
booking-term / guardian snapshots remains separate work. Real-device repetition,
physical tracking, pending-draft recovery, live payment/refund settlement,
team conversations and native trip-change screens remain outstanding. The earlier
startup transport EOF and missing-subscription setup failures are not explained
by this change. No release-manifest requirement is accepted here.

## References

- [Firestore transaction contention](https://firebase.google.com/docs/firestore/transaction-data-contention)
- [Supported generated-client retry option](https://github.com/googleapis/gapic-generator-typescript/pull/1571)
- Installed source: `@google-cloud/firestore` 7.11.6, `google-gax` 4.6.1,
  `firebase-tools` 15.20.0, Firestore emulator 1.21.0, Node 22.22.3, Java 21.

Raw file SHA-256 values are independently pinned in
`tests/trip-contention-evidence.test.mjs`. JSON and server logs are originals;
terminal line endings and trailing blanks are preserved.
