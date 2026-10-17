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

## Accepted Screen Verification

Verified by [Native CI run 38838963962](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38838963962)
at source `e9c7eb5c62260af2f38d486f6c9e84801ac2feb5`. Unchanged
`ui-results.json` records run `faeaaafa1c0bf888860d4c3281d3b893`, completed at
`2026-10-16T02:23:27.411Z`. All 15 instrumentation cases pass across seven
invocations: nine combined app/search cases and six single-case phases. All seven
original text outputs are retained. The 16 result group IDs are not 16 journeys.

The app cancels one requested and one approved two-seat booking, dismisses a
confirmation without writing, refuses a third booking as the driver, and shows
that refusal after the parent signs back in. Independent service checks verify
three terminal records, correct actors, restored/unchanged four-seat capacity,
exactly three correctly addressed notifications and no stale active-queue entries.
These are stored notifications, not push-delivery evidence. No payment is made.

`general-ui-passed.xml` records 60 cases: 50 passed and ten intentional local/live
gates skipped. Its two reservation component cases cover confirmation in a 320dp
content column and disabled driver actions while busy; they use an explicit fake
gateway, not a physical narrow phone. The separate SDK-only multi-seat case and
four fake-gateway search cases retain their original scope in `ui-results.json`.

Both original 1080x2400 app captures were visually reviewed and copied unchanged:
`local-parent-reservations-cancelled.png` shows the two cancelled records;
`local-driver-reservation-declined.png` shows the refused record. Only synthetic
fixtures appear. The captures show acknowledged outcomes while the broader app
refresh is still finishing; disabled refresh/actions are not a network-loss test.
No other new captures are accepted for the site.

Earlier run `38837570786` passed general instrumentation but stopped before this
new phase: the old approval test clicked a visible but still-disabled action
before the app-data refresh completed. The harness now waits for enabled actions
and the confirmation dialog. This changes synchronization, not business behavior;
the earlier run is not accepted as complete. Messaging also passes in this replay,
but this does not explain the previously recorded SlotWriter crash or prove all
account/network transitions stable.

Historical evidence is unchanged. Full account/crash stability, trip and club
management, settings, physical tracking, live payments/push and refund settlement
remain open. iOS is unchanged. No final release-manifest items are accepted here.

## Rollout Boundary

`listReservations` and `declineBooking` have not been deployed to production.
Production rollout must deploy these callables before distributing the matching
app; the local APK points only at the isolated demo project. No production users,
roles or records were changed. Existing checked-in booking owner/createdAt indexes
cover these queries, so no Terraform/index/billing change is required. Web smoke
now watches the new native contract modules and checks this evidence.
