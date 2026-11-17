# iPhone Booking Ownership, 4 November 2026

## Before And After

At `0d502700fbbcbf66682912b0f44557c6f4feeaba`, actual AppState request and
approval methods restore confirmation feedback after sign-out and a fresh session
with the same UID. Approval also starts seven data reads under the fresh session.
The controlled reproduction uses suspended synthetic gateways and fails with exit
133. Both actions are observed before asserting failure. See `baseline.txt`.

The candidate uses immutable account-generation leases for both actions. Parent
requests and driver approvals require their current selected and granted role;
success, errors, search-result removal and approval refresh retain the initiating
access. Outstanding work blocks authentication until settlement. A separate booking
busy flag excludes duplicates without clearing another operation's loading flag.
Only an `approved` server response can display approval feedback.

Home, trip, driver-request and search actions receive access from the authenticated
shell. They cannot adopt a newer session through an old view. Home/trip actions
submit the displayed TripSummary, including its captured booking terms, instead
of looking up potentially changed terms by ID after the click. Existing backend
terms verification and durable booking request recovery remain unchanged.

## Executed Checks

`bash scripts/check-ios-native-plan.sh` compiles the actual app-state methods with
Swift 6 and all prior Foundation checks. `native-checks.txt` exits 0 and retains:

- Both original same-UID reproductions: no restored feedback or follow-up reads.
- Twenty-four delayed request/approval success/error boundaries: logout,
  different/same UID, role round-trip/revocation and cancellation.
- Duplicate exclusion, pending-work authentication denial, settlement cleanup,
  current errors and explicit retry, and unrelated loading-state preservation.
- Stale-screen and unrelated-role rejection, strict approval status, and a
  displayed trip with valid captured terms retained after current trip data changes.
- Current booking-review failure removes its own stale search result; the same
  late error after reauthentication cannot remove the new account generation's result.

## Limits

Gateways and input trips are synthetic. No service, maps, live account, payment,
production write, native UI or physical device is used. SwiftUI wiring, the real
booking transport/durable recovery and the complete current iPhone flow still
need their corresponding integration tests. This is not full sign-out, global
transport drain, search-provider lifecycle, real child consent or release
acceptance. The profile logout action remains unwired. Web Integration Smoke
already runs the expanded account-work and search contracts; iPhone CI already
runs the extended native plan. No infrastructure or test scope is weakened.
