# iPhone Driver Onboarding Ownership, 4 November 2026

The payment screen now receives immutable account access from the authenticated
shell. Its controller keeps a separate in-flight operation and view revision;
closing/reopening a view cannot reactivate an old response. Onboarding may start
only for the current granted driver role. Each account/link response is checked
before the next request, URL handoff or feedback mutation. Outstanding work keeps
its account lease until actual completion, including after cancellation or logout.

The screen no longer implements its own unguarded account/link sequence or changes
the global loading flag. Its booking payment, verification and initial refresh
also use captured account access. An action retained by an old screen cannot
adopt a new session, even when the UID is the same. Existing checkout confirmation
still depends on a correlated server status, never payment-sheet completion.

## Executed Local Checks

`bash scripts/check-ios-native-plan.sh` compiles the actual controller, payment
extension, account state and all existing Foundation checks with Swift 6. The
retained `native-checks.txt` exits 0 and covers:

- Twenty-eight delayed success/error cases at account and link boundaries, with
  logout, different/same UID, role round-trip/revocation, view close/reopen and
  cancellation. No stale handoff, follow-up request or feedback is accepted.
- Duplicate exclusion, explicit retry after failure at either request, and valid
  current handoff. Test callbacks collect synthetic URLs; no browser is opened.
- Denial for missing email/configuration/callbacks, non-driver or closed views,
  insecure and credential-bearing callback/link URLs, and empty link hosts.
- Revocation during initial feedback or URL handoff does not restore old feedback
  or start another request. Settled operations release their leases.
- Actual stale-screen checkout and status actions issue zero gateway requests
  under a fresh same-UID session. Earlier 24 payment response cases still pass.

The real payment gateway now uses the existing typed, UID-owned callable boundary
for all four account/link/intent/status operations. It checks cancellation and
SDK UID before issue and after response; payloads and strict booking/intent/amount
mapping are preserved. `bash scripts/check-ios-support-concurrency.sh` typechecks
the actual gateway with strict Swift 6 callback-signature fixtures and warnings as
errors. `callable-signatures.txt` exits 0. This is not a real SDK execution.

## Limits

No live account, provider request, payment, browser, production write or new native
image is used. The SwiftUI wiring and real SDK integration still require the
candidate's SDK-linked build and rendered tests. No full logout, SDK modal/customer
cleanup, cancellation of an already-issued transport, process-death recovery,
refund, real onboarding, physical-device or release acceptance is added. The
profile logout action remains unwired. Web Integration Smoke already runs the
expanded driver/payment contract tests; iPhone CI already runs both native and
strict callable checks. No infrastructure or workflow scope is changed.
