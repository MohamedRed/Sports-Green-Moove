# Local App Ride Completion Evidence

Date: 2026-10-15. Source: [Native CI 38786692741](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38786692741),
commit `72174ebae27d288a01396e97bea69925ac78a131`, artifact
`android-connected-ui-test-results`, run `8319bcfb55d50d2eb0ad68f697f78a13`.
The sanitized `results.json` is copied unchanged. Seven instrumentation cases
passed across three app-process invocations. Its eight group IDs are scoped
assertion groups, not eight independent test methods.

## Verified Through The Actual App

The first invocation checks the parent flow, driver booking approval, landscape
login and two UI regressions. A separate invocation checks theme persistence.
The final case signs in as the driver, starts the seeded trip, confirms pickup
and dropoff for both approved bookings, completes the ride, opens impact/rewards,
then signs out and logs in as the parent to find past-trip history and submit
a five-star review. No privileged SDK write substitutes for those user actions.

Assertions require disabled early completion/dropoff actions, updated passenger
statuses, stopped location service after completion, loaded ledger values,
completed parent history, absence of the driver's feedback after account switch,
and removal of the review prompt after submission. Independent local database
checks then require two completed bookings, a completed trip and ride, four manual
audit events, one impact entry, one reward entry and one five-star rating.

Separate component tests cover observer-only controls, confirmation ordering,
ledger back navigation, message non-overlap/dismissal and error precedence.

## Reviewed Captures

- `local-ride-passengers-delivered.png`: both passengers delivered; repeated
  actions disabled and completion enabled. The screen is intentionally scrolled
  to the passenger/end section, so the map heading is partly above the fold.
- `local-ride-parent-history.png`: parent past-trip tab contains the completed trip.
- `local-ride-impact.png`: one completed driver trip, 3.8 kg displayed and 28 km.
- `local-ride-rewards.png`: 2.96 EUR balance, including the seeded 2.50 EUR and
  this ride's 0.46 EUR test credit. No withdrawal was attempted.
- `local-ride-review-prompt.png`: parent review prompt after completion.
- `local-ride-review-sent.png`: successful submission and no pending review.

All six are synchronized app-window captures, visually reviewed without edits
to app pixels. They contain synthetic records only, no login credentials. Earlier
`8ee6cb0` captures with an overlapping/persistent completion banner were rejected;
these replace them after the actual layout/session cleanup fix.
Prior `local-ui-2026-10-15` evidence remains unchanged and separately scoped.
No new video was produced by this suite.

## Limits And Remaining Work

The run uses a disposable emulator, pre-granted permissions and synthetic fused
locations, with credential-free loopback-only demo services. The map is explicitly
unavailable in this local build. These captures do not prove real GPS, permission
disclosures, background/locked-screen reliability, route maps, live push, payments,
refunds, payouts or live-provider audit exports. No release manifest item is accepted.

Completion inputs remain caller-supplied, so amount display is verified, not
independent mileage or reward eligibility. History is bounded/read-only, not full
pagination or trip-detail navigation. Parent active-ride observation has component
and service coverage, not a complete multi-phone native run. Active-ride logout,
restart and tracking resumption remain separate checks; this case signs out only
after completing the ride and stopping its service.

Chat replies, club decisions, trip management, booking rejection/cancellation UI,
editable account settings and contrast work remain as documented in the portal.
