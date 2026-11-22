# Local Trip Cancellation Checks - 16 October 2026

## What Passed

`services.json` is the unedited output of the isolated local service suite:
20/20 groups, including all prior 19 groups. The new group uses signed-in HTTP
calls against the real callable implementation and independently reads stored
trips, reservations, receipts and notices. Synthetic accounts/records only;
provider egress is disabled by the existing local runtime.

The driver cancels a trip with three requested/approved reservations belonging
to two parents. Two approved seats are returned exactly once. Three seats were
initially offered out of four; cancellation restores three, not four. The
previously cancelled reservation is unchanged. Parents see closed reservations
without available actions and one stored inbox notice per recipient. The
synthetically paid reservation is flagged pending refund, not refunded.

The evidence covers repeated and simultaneous identical cancellation requests,
changed-intent rejection, new booking/approval/payment invalidation of a preview,
outsider and foreign-driver denial, administrator attribution, active and orphan
ride rejection, malformed booking metadata, and request/approval/start races.
At 101 active reservations the operation fails without changes; exactly 100 are
then cancelled atomically with a single notice for their shared parent.

`rules.json`: 49/49 rules checks, including nine cancellation-field/receipt
checks, plus the earlier team, capacity, membership, chat and general rules.
`payments.json`: 11/11 synthetic reconciliation checks. These cover late success
with absent/not-required/pending refund state, preserved settled refund state,
payment-first/cancellation-first/concurrent ordering, existing ledger and payout
checks. The two suites ran separately to avoid their existing shared-project
fixture cleanup interfering with each other.

## Reproduce

```sh
npm run test:local-flows
npm run test:rules
npm run test:stripe-webhook-flow
node --test tests/trip-cancellation-evidence.test.mjs
```

## Limits

These changes have not been deployed to production. The native trip cancellation
screen, its confirmation/recovery behavior and device replay remain outstanding.
There is no new app recording or screenshot from this backend check. Trip editing
also remains open. Existing app captures keep their original date and scope.

Paid state here is synthetic, not proof of a real charge, refund or settlement.
The cancellation receipt is historical: later payment success flags the booking
for refund without rewriting its receipt. Actual refund processing, payment
intent/provider races, push delivery, physical-device tracking and real safety
audit evidence still need separate verification. The overall release remains
incomplete; no manifest requirement is accepted by these checks.

The contract and bounded transaction are documented in
`docs/contracts/trip-cancellation.md`. Query indexes and protected fields are
versioned with the application; no paid resources or Terraform infrastructure
have been created or applied.
