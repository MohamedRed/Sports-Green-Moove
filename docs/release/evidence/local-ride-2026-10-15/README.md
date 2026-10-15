# Local Ride Integrity Verification

Date: 2026-10-15. Sanitized output: `results.json`.
Run: `c10397ea6c323ff457a8c4351575afda`.

The guarded `npm run test:local-flows` run passed all 11 scenario groups on
the working changes following `8024dbb`. It used a fresh demo project, synthetic
accounts and loopback-only services. No cloud account, production record,
provider payment, device location or billing resource was accessed.

## Newly Checked Boundaries

- Two concurrent starts produce exactly one ride; retry resumes that same ride.
- Explicit booking lists must include all approved bookings, without duplicates.
- New bookings, approvals and attached passenger cancellations are refused after
  departure. A completed trip cannot be booked or started again.
- Only the driver can confirm passengers. Wrong child, wrong booking and an
  approved booking not attached to the ride are refused.
- Confirming one booking does not update another booking for the same child.
- Dropoff before pickup, repeated confirmations and premature completion fail
  without replacing original audit records or creating reward/impact credits.
- Completion closes the trip and attached bookings; audit and ledger assertions
  from the original lifecycle suite continue to pass.
- A synthetic legacy active ride without a trip lock blocks duplicate creation.

Before the fix, the new wrong-child assertion failed because `markPickup`
accepted the mismatched identity. That failed run is not accepted evidence.
The checked-in output is from the passing, current implementation.

The existing seeded trip already contains an approved booking. The standalone
lifecycle smoke now creates its own trip instead of deliberately leaving that
passenger behind. The separate multi-booking safety case checks inclusion of
all approved passengers and keeps the stricter production rule intact.

## Limits

These are service-level checks, not app screenshots or physical-device evidence.
The approved-but-unattached and legacy states are direct, local Admin fixtures
used only for negative safety checks. They are not claimed user journeys.
CO2/reward amounts still use caller-supplied completion inputs; this run proves
record creation and duplicate protection, not financial or distance validation.
Live payments, real tracking, permission UX, notification delivery, club
decisions, trip management and refund settlement remain unverified.

The new Firestore index and rules are checked in, not deployed to production.
See `scripts/qa/README.md` for deployment order and legacy-session reconciliation.
Web Integration Smoke already runs the local suite and covers `functions/**`,
`scripts/qa/**`, rules, indexes and this evidence directory; no trigger change
was needed.

## Native Run Not Accepted

[Native CI 38783040437](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38783040437)
on `a35d16a` crashed during the component screen cases, before the local ride
suite executed. Its Maps dynamite renderer could not load
`org.apache.http.ProtocolVersion` under Play services 24.23.35. No new phone or
app-flow success is claimed from that run.

The Maps SDK 20.0.0
[official release notes](https://developers.google.com/maps/documentation/android-sdk/release-notes#january_31_2026)
document this regression and require an application-level optional
`org.apache.http.legacy` library declaration for affected renderers. That
declaration is now in the main manifest so affected real devices are covered as
well, rather than disabling maps in the tests or silently changing the renderer.
