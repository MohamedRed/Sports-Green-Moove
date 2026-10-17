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

## Subsequent CI Screen Verification

[Native CI 38999953425](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38999953425)
ran pushed source `366a5ac63b37c27ac09e140906435bec1777de6a`. Its ordinary
instrumentation suite recorded 80 cases: 64 executed, 16 intentionally assumed out
in this non-emulator-backend stage, zero failures or errors. All three
`BookingReviewFlowTest` cases actually executed and passed. `native-components.xml`
is the original report, not a three-case reconstruction. The two reviewed PNGs
show the actual controlled component render (fake gateway, not the real SDK race).
The review message and new-search action fit at 320 dp / 1.5 font scale; other
existing form controls truncate their labels at that size. That separate layout
gap is not fixed or accepted by these focused recovery tests.

The later full local app replay **failed**, so this Native CI run is not green.
`network-preparation-failure.json` retains the actual incomplete run
`94d5b9ed9fb95675d9c4104d151c14c6`: the conversation opened, but preparation
timed out before disconnect or sending. The phone reported no default data
subscription and no cellular Internet transport/callback, despite enabled mobile
data, a ready SIM and modem registration `home` before/after. The backend remained
reachable over Wi-Fi. The requested cellular callback was released. This is not
proof of offline send, recovery or a successful final 21-case replay; no complete
host results receipt was produced. No timeout, skip, fallback or automatic rerun
was added to conceal this failure. The emulator provisioning cause remains open.

The independent Web Integration Smoke run 38999953432 passed all 14 controlled
booking cases against the same production source hashes (run
`38572ac6337696dd7d4942e1a622ecb0`, 03:48:55 UTC). Backend, release checks and
Android unit tests also passed; that does not cancel the failed full Native run.
The booking flow keeps its October 16 full-scenario date on the portal; appended
component captures explicitly state their October 17 date and simulated scope.

Additional original SHA-256 values:

| File | SHA-256 |
| --- | --- |
| native-components.xml | `b22742782bfceb0d9c591fed776b4d3b19ede894c690d0aea84ad8bfb6088535` |
| network-preparation-failure.json | `4810efdb5f38881a47745157455e696872b5019b1cde6f7c9bb202b9e4943057` |
| modem-before.json | `613515821592d1473a258e149e2d437c018a52f47060e9fecaf40bd4b6924b1e` |
| modem-after.json | `932fe648488277a0fa105e206950a808f544b20158ea7f6f5b2fec29da4b1225` |
| booking-review-required.png | `c57d5681d3562c514dc2be6dffcbe859c92a21cec9bc9bc3a4b56267deaf2425` |
| booking-review-narrow.png | `cb6b488a2e3edc0dce613ed720d0d294198f9cca6dcbb839eb4f78e89ecf6a1f` |
