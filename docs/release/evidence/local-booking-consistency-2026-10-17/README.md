# Booking Consistency — 17 October 2026

## Result

The original handler at `24ae325eb26b930299bed1e647742f62833228ff`
passed 3 of 13 controlled local cases. It created requests after operational terms
changed, or after child guardian authority was revoked or the child was deleted.
It also returned stale child labels and trip titles. `before.json` preserves that
failed run (`b46560271a9c7b6d45b5cd85b09f6fec`, 03:18:36 UTC).

The corrected handler passed all 14 final cases in `after.json`
(`e85c1073a713f312d297bf7b43fe0a76`, 03:38:06 UTC). The first 13 reproduce
the baseline cases. The additional final case uses actual local booking approval,
trip-change proposal, parent acceptance, quote and application handlers between
preflight and transaction. The previously approved parent's agreement becomes
900 cents; the stale new request is rejected with zero requester bookings.
The baseline did not run this fourteenth case.

## Changes

`requestBooking` now retains the initial server-read operational revision outside
the transaction callback, rereads the trip inside the transaction and refuses a
different revision with `aborted`. Current child authority and its display label
are read inside the same transaction on every attempt. Cosmetic title changes do
not invalidate agreement; current titles are returned. Capacity and availability
remain separately enforced. Invalid operational metadata fails closed.

Android maps only the booking callable's `ABORTED` to a review-required error.
The old results are cleared and a fresh search is required, without automatically
resending a booking. A late failure cannot erase a newer search, and a closed
account controller cannot update another account. Other errors retain their
existing policy. The callable payload is unchanged; no fallback or migration is
introduced. No infrastructure change or Terraform update is required.

## Verification

- `functions.json`: all 228 tests passed, including 27 intent-validation cases
  and 11 transaction tests. Transaction retry unit cases simulate the SDK callback;
  they are not an observed live-provider retry.
- `after.json`: actual compiled production handlers against the isolated
  `demo-sgm-local-qa` database. The harness deliberately mutates between the outer
  preflight and first transaction read; it is not a phone test. Booking counts are
  scoped to the requesting parent. The fourteenth case also retains the existing
  other parent's approved booking, explicitly listed in its application receipt.
- `search-recovery.xml` and `error-policy.xml`: eight JVM cases passed, with no
  failures or skipped cases. Android instrumentation sources compiled locally.
  The three new component tests and their standard/narrow captures must execute
  in Native CI before any device-component pass is claimed.
- `services.json`: all 24 wider local service groups passed at 03:35:05 UTC,
  including parent confirmation, application, supplements and cancellation.
- Web Integration Smoke runs the new controlled harness and evidence validator;
  Native CI runs the component suite and requires both recovery captures.

## Boundaries

This does not bind a request to the terms previously displayed by the client:
changes before the server preflight remain a separate gap. Booking response-loss
idempotency, refreshing a revoked child list, iOS recovery, native driver editing
and parent decision screens remain open. Existing bookings still require explicit
parent acceptance of changed time, route or price; this fix is not that complete
editing UI. No real payment, refund, physical device, background tracking or
production deployment was performed. The additional application's route provider
is explicitly synthetic. Release and portal booking statuses remain partial.

## Immutable Evidence

SHA-256 of the original retained bytes:

| File | SHA-256 |
| --- | --- |
| before.json | `2dead076384b3eea937dc1536f7eab2a4a5cc20ee7c8ff92cb4947e8be097a6c` |
| after.json | `2d4eb9032cd6a1535a33aa1ac7e82d89f12967afd1bf037e4719f7dd57f81766` |
| functions.json | `7529bad4660c165aba8e3fe049007f1b563b9fa1bdbfc0d3f94cf8c737ebd8a6` |
| search-recovery.xml | `ab9220a7e75cdd8304fc1488fc47c669c60169077357e2bef5996247c095ec14` |
| error-policy.xml | `88fe955fb4627b0c5a7921426c34e6c04292da77bc4c63d89a6feb3645ca28ff` |
| services.json | `391c9040ff793b46eb4a8cb21be692b44ab7d11bb8ab4ea1549b00463e38e9b0` |

Use `npm run test:booking-consistency` for a new isolated run. Preserve its own
timestamp and run ID instead of rewriting these historical receipts.
