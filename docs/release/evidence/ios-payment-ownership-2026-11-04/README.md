# iPhone Payment Callback Ownership, 4 November 2026

## Controlled Reproduction

The baseline payment implementation at
`a23cb9d67f6163156150dbfd320aff7e7ae95835` checks only the current UID. The
actual AppState verifier is suspended in its synthetic status gateway, signed
out, and assigned a fresh session with the same UID. Releasing the recorded
response restores a payment-confirmed notice and starts seven account-data
reads. The unchanged reproduction fails with exit 133. See `baseline.txt`.

The candidate retains an immutable account-generation work lease for payment
preparation, presentation and status verification. Every returned response must
still own that lease before it can change state, present the sheet or start
another read. Confirmation refresh uses the initiating access, never fresh
ambient account access. Old work remains registered until it settles, keeping
new authentication blocked through the existing account-work mechanism.

## Executed Checks

`bash scripts/check-ios-native-plan.sh` compiles the actual payment extension
and existing presentation entry point with Swift 6, alongside the full existing
Foundation checks. The candidate exits 0; see `native-checks.txt`.

- The original same-UID reproduction no longer changes feedback or reads data.
- Twenty-four delayed preparation/status success/error cases cover logout,
  another UID, same-UID reauthentication, role round-trip, role revocation and
  task cancellation. Revoked work cannot issue follow-up reads or change state.
- Duplicate invocation issues no second request. Outstanding operations retain
  their drain; new authentication and new-generation work are denied until
  settlement. Each settled operation releases its lease.
- All five correlated server states still apply for a current account. Only
  `recorded` refreshes data; terminal and pending target behavior is preserved.
- A current status error remains visible and allows an explicit successful
  verification retry.

## Limits

All gateway replies are synthetic. There are no provider requests, real
transactions, production writes, new screenshots or physical devices. The
existing non-UIKit presentation branch is compiled; no SDK payment sheet is
presented by these checks. The separate SDK-linked iPhone job must verify this
candidate. These results do not accept full logout, SDK modal/customer cleanup,
already-issued transport cancellation, driver onboarding, stale-view action
dispatch, process-death recovery, refunds or release readiness. The profile
logout action remains unwired until its complete lifecycle is safe.
