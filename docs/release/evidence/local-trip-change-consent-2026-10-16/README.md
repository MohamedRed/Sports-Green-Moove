# Local Trip Change Consent - 2026-10-16

## Scope

This is the server proposal/parent-decision stage of the approved editing flow,
not the completed editor. The driver proposes complete schedule, route and price
terms against an authoritative trip/reservation/guardian revision. Two parents
review their own reservations and explicitly decide against the exact proposal.
Request identities prevent duplicate or conflicting proposal/decision/withdrawal
effects. Declining or withdrawing retains the original trip and reservations.

The reports are original, unedited JSON outputs pinned in `artifact-sha256.json`.
`services.json` contains all 22 local groups, including all previous scenarios.
Run: `4d93d74f2e29613df25a7fa878006ff6`, tested at
`2026-10-16T19:43:49.389Z`.
`unit.json` contains 154 passing backend cases, including 15 new contract cases
and the pending-proposal search exclusion. `rules.json` contains 102 passing
cases, including 20 direct proposal read/query/create/update/delete denials for
the parent, driver, administrator and signed-out client.

The new signed-in scenario uses four reservations belonging to two distinct
parents. One child reservation has synthetic paid metadata; no charge is made.
It independently checks persisted records after duplicate/concurrent requests,
separate confirmations, conflicting identities, scoped parent reads, refusal,
withdrawal and cancellation. Five unique proposal/confirmation notices are
recorded: two proposal recipients, then both parents and the driver at confirmation.

The source price remains 250 cents after proposed time/route changes and a price
of 400 cents. Unanimous acceptance records consent only: `confirmed`, never
applied. Trip conditions and every original booking/payment record remain
unchanged; the driver then withdraws the confirmed proposal. Consent is not a
charge, refund, changed booking or automatic agreement to a later proposal.

Additional checks cover a cancelled reservation, stale preview, guardian revocation
after an earlier parent's acceptance, a late synthetic payment update, omitted
parent metadata, a corrupted proposal revision, concurrent proposals, a
booking/proposal race, an accept/withdraw race, active/orphan rides, the
100-reservation limit and a proposal without parents. An open proposal denies
new booking/approval/payment/start requests. Cancellation closes it atomically.
No direct client can bypass the authenticated consent operations.

## Still Required

The stage is not deployed to production and has no native editing/review entry
point yet. Final application, recalculated route/impact information, paid price
adjustments, actual provider settlement/refund handling, native recovery and
real-phone replay remain unfinished. Even a confirmed proposal does not release
the pending-change guard until a future completed application stage or explicit
driver withdrawal. No automatic cancellation or payment fallback was added.

The late-payment check changes isolated fixture metadata; it is not a real payment
webhook or a provider-race proof. Existing payment initiation can have an external
request already in flight; final application must fence that path and reconcile
the exact amount/currency rather than relying on this consent stage alone.

There is no new screenshot or video for this service-only work. The private page
retains the original app-cancellation media and its date from
`../local-trip-cancellation-ui-2026-10-16/README.md`. The earlier detail-boundary
and cancellation reports remain unchanged. No physical tracking, safety-audit,
push-delivery, real payment or overall release requirement is accepted here.

The first full-rules invocation stopped before Vitest because its direct shell
PATH did not include the local Vitest binary (exit 127). The corrected invocation
uses the explicit local binary; it is not a repaired product test failure.
