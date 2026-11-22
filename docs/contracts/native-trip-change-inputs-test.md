# Native Trip Change Inputs Test

`LocalTripChangeInputsFlowTest` is a separate required native/backend stage. It
does not expand the scope of archived price-consent evidence or claim that a
new test has executed merely because it compiles.

One synthetic trip departs tomorrow at 09:00 UTC with one approved parent
booking, no arrival deadline and a price of EUR 2.50. The driver signs into the
real isolated app, opens its editor, changes departure through the actual
24-hour Android time picker to 10:00 UTC and changes the price to EUR 4.00.
These fixture times keep both departures on the same Belgian local date,
including daylight-saving transition days. The date picker is not exercised.
The API-35 picker helper requires its real clock-to-text toggle, hour/minute
fields and confirmation button. Missing controls fail; no coordinates, app-state
setters, spinner substitute or retry bypasses the interaction.

Editing either address clears its confirmed coordinates. The app must display
the matching validation and disable proposing. The driver explicitly chooses
the existing "Conserver le lieu actuel" command for each address, restoring
the original points before proposing. This is a negative address-safety test,
not a successful address lookup or route change.

The parent signs into their own account, follows their reservation, checks
both dated departure times and prices, and accepts. The driver signs back in,
sees confirmation and requests the actual route calculation. This local setup
has no live route credentials; the expected visible failure must leave no quote
or application button. No provider response is fabricated.

Only after successful instrumentation and an acknowledged evidence copy does
the host check the run-bound native receipt, two PNG captures, exactly one
confirmed proposal, exact driver/parent/booking identities, the persisted new
departure and price, unchanged coordinates and unchanged original trip and
booking snapshots. It also requires a scoped parent review, outsider denial,
zero saved route quotes and exactly three unique notices for the two accounts.

`trip-change-inputs-ui-stage.json` is written exclusively after these checks.
It is explicitly not a full replay and records successful route change,
application, payment, date-picker and physical-device coverage as absent.
The complete runner now also requires the separate date/arrival stage (27 groups).
Previous 25- and 26-group raw evidence remains an immutable record of what actually
ran at that time. Native execution
and visual review are still required before publishing any resulting capture.
