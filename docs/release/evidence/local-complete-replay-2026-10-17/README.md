# Completed Local Replay, With Reliability Risks Retained

Verified **2026-10-17T02:11:48.524Z**, run
`a7a5366ace1d3ec71b9385ef4fa55401`, source
`1d5cb260d57c55ae615d44a7cdbdf69e9ac99261`.
[Native 38992880614](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38992880614)
completed successfully. All enabled PR checks at this source were green; iOS
remained intentionally skipped. This is **local emulator evidence only**.

## Complete Recorded Run

- 21 isolated instrumentation cases across 13 completed transcripts and 22
  independently verified coverage groups. All required earlier groups remain.
- Three same-run evidence-copy receipts completed with status zero, no signal
  or error, before the final result was written. No cleanup-copy substitution.
- The separate ordinary component XML has 77 cases, zero failures/errors and
  16 intentional skips. All four controlled restoration-screen cases ran.
- Confirmed-message restart retained the session/history and original message
  identity/time, then exchanged the next parent message and driver reply. Saved
  checks record three messages and three read notices, with zero duplicates.
- Controlled post-commit reply loss, an explicitly rejected retry and final
  recovery retained one message/notice and the same request identity.
- The OS network case proved Wi-Fi/cellular preparation, cellular handover,
  both radios offline with an unreachable backend, and restoration. The draft
  survived; an explicit retry and other-account reply produced two saved messages
  and two notices without duplicate or cross-account draft. Radio flags, not an
  identical physical association, are the restoration contract.
- Driver cancellation closed two bookings, emitted one parent notice, restored
  three offered seats and showed one **pending**, not executed, refund. Synthetic
  paid metadata is explicit; no real charge/refund is inferred.

The four search cases use explicit component fake gateways. The two-seat request
uses the native SDK rather than the booking screen. Membership manager decisions
use authenticated local SDK calls, not a native management screen. Synthetic
positions and pre-granted permissions do not prove physical tracking or consent
on a real phone. Twenty-eight original artifacts are byte-pinned by SHA-256.

## Failures Remain Unexplained

The [retained previous recheck](../local-session-restoration-2026-10-16/screen-recheck/README.md)
failed mobile-data preparation without a default subscription. This run already
had the required route and passed. No application, network-control or service
behavior changed between these sources, only evidence and its validation. A passing run therefore
does not explain or resolve that setup instability.

The previous Web run failed the acceptance/cancellation transaction race with
`Transaction is invalid or closed`, 23/24 groups. Web
[38992880629](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38992880629)
passed at this source, but no transaction-order root fix was made. The original
failure remains a release risk. No allowed outcome, deadline or assertion was
relaxed and no automatic rerun/fallback was introduced to obtain acceptance.

The earlier authentication stream cause also remains unknown. Eight state and
four controlled screen cases verify explicit startup recovery; this successful
rotation does not reproduce the original stream failure on a real provider.

## Still Required

This result accepts no release-manifest requirement and is not a production
deployment. Physical tracking, real safety events, push, live charges/refunds,
expired tokens, unsent-draft process recovery, team groups and complete native
editing/parent review/payment screens remain outside this run. Parent confirmation
for changed time/route/price remains the approved rule. The overall goal is active.
