# Stripe Connect Production Readiness - 2026-06-18

## Scope

This evidence records the Stripe Connect production-readiness revalidation after the app's driver onboarding path was moved from Stripe Accounts v2 to standard Stripe Connect Express onboarding.

No Stripe secret values are included in this artifact.

## Code Change Validated

- Commit: `96335d85743d7a8db1ef38a494adc4455eea41cb`
- Driver account creation now uses Stripe Connect Express account creation through the Stripe v1 Accounts API.
- Driver onboarding links now use Stripe v1 Account Links.
- Stored account records are marked `accountVersion: "v1-express"`.
- The production readiness probe now checks the live account, balance, enabled webhook endpoint, Connect account-list access, and return/refresh URL hosts.

## GitHub Actions Evidence

- Workflow: Release Readiness
- Job: Production provider secret validation
- Run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27769270417
- Job URL: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27769270417/job/82164447372
- Completed at: 2026-06-18T15:10Z
- Conclusion: success

## Sanitized Result

The `Validate Stripe production readiness` step returned:

- `ok: true`
- `readinessStatus: production-configured`
- live-mode balance readable
- platform account charges enabled
- platform account payouts enabled
- platform details submitted
- enabled Stripe webhook endpoint points at the production `stripeWebhook` Cloud Function
- Stripe Connect v1 account listing reachable
- Connect return and refresh URLs resolve to the approved app host

## Residual Risk

This validates provider readiness and code compatibility with standard Stripe Connect Express. It does not replace:

- a real paid ride using PaymentSheet,
- Stripe webhook payment reconciliation evidence,
- driver payout evidence,
- physical real-device release evidence.
