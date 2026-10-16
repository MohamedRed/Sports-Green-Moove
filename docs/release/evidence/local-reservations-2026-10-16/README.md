# Local Reservation Decisions

Date: 2026-10-16 UTC. This is isolated local evidence, not a production deployment,
physical-phone approval, payment or refund-settlement claim.

## Service Evidence

`services.json` is unchanged output from run `f48e56d3f1f7102f306fba08f8b2a96c`,
completed at `2026-10-16T01:29:41.876Z`. All 15 service groups pass. The new
`reservation-decisions` group proves:

- Only the owning driver can decline a pending booking on an open trip. Guardian,
  foreign driver, malformed ID, repeated/late decisions and terminal mutations
  are rejected. Refusal does not change four available seats; one stored refusal
  notification is addressed to the guardian.
- The guardian can cancel pending and approved requests. An approved two-seat
  booking leaves two available seats; concurrent cancellation restores four only
  once. Concurrent approve/decline produces one winner and consistent capacity.
- Parent/driver pages reach all 25 seeded historical records per role without
  duplicates. Explicit guardian ownership takes precedence over a conflicting
  legacy requester field. Unauthenticated, wrong-role, foreign-owner cursors and
  malformed cursors are rejected.
- An active passenger cannot cancel. Missing active-ride booking membership now
  fails closed rather than returning seats on incomplete safety data. Listing
  exposes no cancellation action for the active passenger.

The earlier `harness-attempt.json` is diagnostic: its new group used
`startRide.rideSessionId` instead of the existing `startRide.ride.rideSessionId`
response contract. Its other 14 groups passed, but it is not accepted as complete
decision evidence. The accepted run corrected that harness path.

## Native State And Payload Evidence

Original Gradle XML: `state-passed.xml` has ten passing cases and
`payload-passed.xml` has three, with no failures/errors/skips. These cover exact
capabilities, missing/invalid data without invented defaults, concurrent taps,
explicit refresh after an uncertain decision, acknowledged write versus failed
reload, closed-session callbacks, initial versus completed-empty history and stale
pagination. The complete Android unit
suite and instrumentation APK compilation pass locally. Backend unit tests pass
134 cases, including five new permission/schema/cursor cases.
`state-before-loading.xml` retains the preceding nine-case pass before the
explicit initial/empty-history regression was added; it is not a failing baseline.

The Android reservation tab now has a paginated parent/driver list, explicit
confirmation, French statuses and server-provided allowed actions. Decision state
is scoped to account/role and cleared on disposal; it does not automatically retry
unconfirmed writes. The previous global approval callback and unused gateway
method have been removed. Amounts are labelled per place; cancellation does not
claim that a refund has settled.

## Pending Screen Verification

The new isolated app test must cancel one requested and one approved two-seat
booking, dismiss a confirmation without writing, refuse a third booking as the
driver, and show that refusal to the parent. Independent service verification
requires three terminal records, correct actors, restored/unchanged capacity and
exactly three notifications. Two component cases additionally cover confirmation
in a 320dp content column and disabled driver actions while busy. Compilation is
not execution: no new reservation screenshots or screen success are accepted yet.

The local runner now requires 15 instrumentation cases and 16 scoped result
groups, including the pre-existing SDK-only case. Historical UI evidence is kept
unchanged. Full account/crash stability, trip and club management, settings,
physical tracking, live payments/push and refund settlement remain open.

## Rollout Boundary

`listReservations` and `declineBooking` have not been deployed to production.
Production rollout must deploy these callables before distributing the matching
app; the local APK points only at the isolated demo project. No production users,
roles or records were changed. Existing checked-in booking owner/createdAt indexes
cover these queries, so no Terraform/index/billing change is required. Web smoke
now watches the new native contract modules and checks this evidence.
