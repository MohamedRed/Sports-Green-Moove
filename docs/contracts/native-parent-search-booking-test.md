# Full Parent Search And Two-Seat Booking Trial

Preparation only. `LocalParentSearchBookingTest` is not executed by the ordinary
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

No map call has been authorized or executed for this new trial yet. The existing
route-edit broker still allows only five Places/Compute Routes calls and rejects
Route Matrix. Do not relax it silently or run this case with fake providers.

This search needs two suggestions, two place-details calls, one 3-by-3 route
matrix and one final route for one candidate. The proposed ceiling is eight
requests without retries; a matrix request contains nine potentially billable
elements. The new explicit approval and bounded broker/host runner must be ready
before execution. The server credential must stay outside the APK and evidence.
Do not widen existing key restrictions or enable payments/social services.

The scenario is one local app execution across two accounts on one disposable
emulator, not two physical phones, physical tracking, real payments, guardian
consent audit acceptance or release completion. The partner search/booking flow
must stay partial until reviewed original evidence proves this whole chain.

## Accessibility

The trip search icon and both month arrows now expose French accessible names
and a button role. The ordinary component regression exercises those named
actions without provider access. Its compilation passes; native execution and
visual review are still pending. This is not a screen-reader-device audit or
proof of the full booking trial. Geometry and visible copy are unchanged.
