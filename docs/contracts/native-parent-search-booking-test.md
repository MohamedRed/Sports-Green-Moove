# Full Parent Search And Two-Seat Booking Trial

One approved local trial passed on 2026-10-20, with six provider calls and three
independent saved-state checkpoints. Original evidence and limits are in
`../release/evidence/parent-search-booking-native-2026-10-20/README.md`.
The separately approved 24 October physical trial also passes, with six provider
calls, four independent checkpoints, seven original exports and full record
isolation. Its scope and cleanup are in
`../release/evidence/search-booking-phone-2026-10-24/README.md`. Neither approval
authorizes another run. The ordinary native case below remains emulator-only.
`LocalParentSearchBookingTest` is not executed by the ordinary
offline suite: without the explicit `searchBookingApproved` instrumentation
argument it skips before opening the app or making a provider request. It also
requires the local debug package, demo project, a disposable emulator, the exact
ephemeral run ID and a future fixture departure. A compiled test is not a pass.

## Required Run

- Use one fresh disposable device with the approved continuous installation
  guard and independent restoration. Do not alter personal devices.
- Keep parent, driver, child, accounts and bookings in the owned local runtime.
  Create one free four-seat trip at a separate future departure window, with the
  exact title `Trajet QA recherche deux places`. Confirm it is the only eligible
  candidate; do not hide or delete other fixtures to manufacture one result.
- Sign in through the actual MainActivity. Open search using its named search
  button. Select provider suggestions for Wavre and Brussels-Central, wait for
  each resolved address, choose the fixture date, Lina, two seats and consent.
- Search through the real callable, select the actual returned match and press
  Request. Verify the UI acknowledgement and a single SDK booking with the exact
  parent, child, trip and two seats. No host-side booking creation is allowed.
- Switch through the actual sign-out/sign-in UI to the driver. Approve the same
  booking with confirmation. Then switch back to the parent, view approval and
  cancel with confirmation. Neither approval nor cancellation may be performed
  by an administrative or authenticated host API action.
- Observe capacity through the real SDK: 4 initially, 4 requested, 2 approved,
  2 after switching back, 4 cancelled. Preserve the six original captures, full
  raw instrumentation and final native marker. Never capture credential entry.
- Independently validate the final booking, its agreed free terms and child,
  capacity, operation receipt, single approval/cancellation effects and notices;
  verify unrelated fixture records and claims remain unchanged. Native flags or
  final capacity alone cannot prove the intermediate stages.
- Independently close connections, remove the owned runtime and own APKs, verify
  endpoints closed, and restore device settings/admin authorization even after
  a failed test. Preserve the first failure rather than replacing it with cleanup.

## Provider Boundary

The user approved one new trial with at most eight provider HTTP requests on
2026-10-20. The completed trial used six calls, with no retries. The existing
route-edit broker still allows only five Places/Compute Routes calls and rejects
Route Matrix. Do not relax it silently or run this case with fake providers.

This search needs two suggestions, two place-details calls, one 3-by-3 route
matrix and one final route for one candidate. The approved ceiling is eight
requests without retries; a matrix request contains nine potentially billable
elements. `search-maps-policy.mjs` and `search-maps-fetch.mjs` define a separate
explicit policy: the six expected calls must follow the selected place IDs and
resolved coordinates, one future fixture and exact response field masks. Eight
is a ceiling, not permission to repeat failed requests. Any provider, response
validation or transport failure stops further calls; all workers share one
broker allowance. The host runner now reads the saved state at requested,
approved and cancelled checkpoints before acknowledging each phone action; it
does not create, approve or cancel any booking. Offline negative tests and
compilation alone do not prove a pass. The dated original run and four reviewed
captures now prove this local trial; physical-device execution remains pending.
Do not reset the allowance or restart a partially spent trial without approval.
The server credential must stay outside the APK and evidence.
Do not widen existing key restrictions or enable payments/social services.

Current checkpoints require the request notice to the driver as well as approval
and cancellation notices. They validate exact recipients and booking sources.
Historical 20 October proof predates the request notice: its v1 format is selected
explicitly and only for its pinned original source commit. Missing current notices
never trigger that mode. A six-group authenticated replay protects this contract
without any provider requests; the unchanged suite reproduces the old verifier's
failure before the correction.

The manual `parent_search_booking` selection in Native CI invokes the separate
`native-search-booking-ui.yml` job. It excludes the ordinary replay and the
six-case safety matrix; routine pushes/PRs cannot invoke it. The app and both
test/admin APKs compile before the fresh phone starts. Only the runtime broker
receives the server map secret. Re-running a paid workflow attempt is rejected.
Retain the allowance, provider requests, checkpoint states, raw instrumentation,
primary file-transfer receipt, source hashes, final record isolation, runtime
disposal and independent phone restoration even when the flow fails.

The scenario is one local app execution across two accounts on one disposable
emulator, not two physical phones, physical tracking, real payments, guardian
consent audit acceptance or release completion. The partner search/booking flow
must stay partial until reviewed original evidence proves this whole chain.

## Accessibility

The trip search icon and both month arrows now expose French accessible names
and a button role. The ordinary component regression exercises those named
actions without provider access. The retained ordinary XML from `b158a75` proves
that named-action regression passed. This is not a screen-reader-device audit or
proof of the full booking trial. Geometry and visible copy are unchanged.
