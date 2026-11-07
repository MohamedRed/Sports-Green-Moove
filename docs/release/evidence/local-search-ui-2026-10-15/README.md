# Local Search Component UI Evidence

Date: 2026-10-15 UTC. Source: [Native CI 38821934904](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38821934904),
commit `b2c463c0a55cedadee4ad125715dc10c3928879a`, artifact
`android-connected-ui-test-results`, local run `ec9d76f93cb225f0513d97777358b239`.
The sanitized `results.json` is copied unchanged. Eleven local instrumentation
cases passed across five invocations, with 12 scoped group IDs. Earlier
six/seven/eight/nine-case evidence remains unchanged.

## Search Checks And Exact Scope

The two search cases use actual Compose controls, `SearchRoute`, the real
`SearchController`, and its session-keyed remembering/disposal. Their gateways
are explicit synthetic test doubles. They do not call real place providers,
authenticate real users, or prove a full application logout/login.

1. Through the fields and suggestion controls, select an origin and destination.
   Verify the resolved origin label, replace it with another typed origin, and
   require its old coordinates/address and matches to be absent while the
   destination remains selected.
2. Populate the synthetic parent's places and match list through the controls,
   start a booking action and a separate delayed suggestion request, and prove
   both entered their fake gateways. Change the host's UID to a synthetic driver.
   Require a new controller and empty fields. Complete the previous requests
   despite cancellation, then require no notice, error or loading callback and
   no old place, suggestion, match or completed-search state in the new host.

The 15 [controller regression checks](../local-search-state-2026-10-15/README.md)
also pass. The real application's synchronous logout wiring is covered by a
static contract and compilation, not inferred as exercised by the host UID swap.
Cancelling an in-flight client call does not undo an already accepted server write.

## Reviewed Capture

`local-search-account-cleared.png` is an unchanged full Compose-window image,
reviewed with a visible header and empty place fields. It contains synthetic data
only, no credentials, keyboard obstruction or edited app pixels.

The edited-place capture is intentionally excluded from partner media: its scroll
position puts the header above the captured area. Its assertion result remains
part of the passing run; a partially framed image is not substituted for proof.
No new video was recorded. The portal retains separately dated earlier search
captures rather than presenting them as images from this run.

## Other Checks And Remaining Scope

The preceding nine cases also pass: local parent/driver navigation and approval,
calendar/landscape/theme checks, ride completion/review/ledgers, and conversation
history/first-message flows. Their persisted-state checks still require two ride
bookings, four audit events, one rating, the exact chat messages/notifications,
and 28 directory entries across pages of 20 and eight. Twenty-five archival
conversations remain seeded fixtures. One earlier chat peer send is local SDK
activity, not a second-phone UI or push action. Keyboard restoration assertions
from `bf86a60` remain in the directory case.

The earlier lifecycle crash did not recur, but is not claimed fixed. Other
authenticated callbacks, role/payment transitions, complete mutable search
options/navigation, real matching/capacity/reservation, offline recovery and
physical phones remain open. Positions are synthetic and permissions pre-granted.
No real GPS, payment settlement, push delivery, iOS or production data was tested.
No final release-manifest requirement is accepted by these local results.
