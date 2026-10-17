# Android Trip Changes

## Entry Points

The owning driver can edit an upcoming, inactive trip from its trip card. A
pending proposal opens review instead of another editor. The last applied change
has a separate review action; it does not prevent a fresh proposal when the
server considers the trip and all balances eligible.

An affected parent opens review from their reservation. `listReservations`
returns `tripChangeId` only for bookings and parents included in the referenced
pending or applied proposal. Current guardian authority is checked again by the
review/decision callables. No new client write permission or index is introduced.

## Confirmation And Application

The editor sends complete proposed time, endpoint coordinates and per-seat price,
bound to the authoritative source revision. Brussels times that fall inside a DST
gap or overlap are rejected rather than silently shifted. Untouched instants keep
their precision and explicit offset. Editing an address invalidates its previous
coordinates until a real place is selected or the original location is explicitly
kept.

Parents see the initial and proposed terms and choose accept or decline. One
parent's agreement does not represent the other parents. A refusal leaves the
original trip and bookings intact. Confirmed agreement is not application: the
driver must explicitly calculate a current server route, then apply it. Displayed
maps show endpoint markers, not an invented driving route. Current terms are also
displayed when a proposal has become outdated.

Payment and refund balances remain separate from agreement and application. The
screen never claims that either has been settled. A proven application receipt
is retained even if refreshing reservations fails, preventing another write.

## Request Identity And Recovery

Review responses include `sourceRevision` and nullable `proposalRequestId`,
`decisionRequestId`, `withdrawalRequestId`. Only the driver receives their proposal
and withdrawal identities; a parent receives only their own decision identity.
No other parent's identifiers or decisions are returned. Application quote
responses echo `tripId`, `proposalId`, `proposalRevision` and `requestId` for exact
native binding. Receipts additionally require the exact signed-in actor.

The gateway checks the account before and after each callable. State belongs to
the account, role and trip and is cleared on disposal; late completions cannot
restore it. Uncertain writes lock actions until explicit refresh. An unchanged
retry keeps the same request UUID. Quote retries also preserve their UUID unless
expiry is known locally or the server returns the explicit
`trip-change-quote-expired` reason. Expiry does not trigger an automatic request.

`resolveTripChangeProposal` is a driver-owned, read-only resolution of a frozen
trip/request identity. Explicit refresh uses it after an uncertain proposal,
even when refreshing the trip list also failed. It never resubmits a proposal.
Only an authoritative `recorded: false` permits a new preview; a failed resolution
leaves the screen locked rather than trying another path.

## Verification Boundary

The implementation includes strict response/payload tests, state recovery and
closure tests, exact-price/DST/place-selection tests, and instrumented screen
cases. The isolated callable suite independently checks caller-only metadata,
affected-reservation links, exclusion of later bookings, and explicit quote
expiry. Screen execution and captures must be recorded separately from compilation.

Not yet proven: a complete multi-account native replay against the isolated
backend, durable pending edits across process death, review history after a
decline/withdrawal, real address/map usability, live payment/refund settlement,
push delivery and physical-device behavior. Production Functions and app builds
have not been deployed by this change. This is not full release acceptance.
