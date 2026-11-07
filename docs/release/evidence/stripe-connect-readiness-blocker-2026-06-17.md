# Stripe Connect Readiness Blocker - 2026-06-17

## Scope

This evidence records the current Stripe Connect production-readiness blocker
without committing or printing Stripe secret values.

## Result

- Environment: production
- Checked at: 2026-06-17T22:51:56Z
- Checked by: Codex
- Result: pending-provider-enablement
- Workflow: Release Readiness
- Job: Production provider secret validation
- Head commit: `e9c9f7c85bb636542deb1c0481d75dcd27485a28`
- Workflow run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27724829810
- Job URL: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27724829810/job/82018636827

## Verified Before The Blocker

The earlier no-side-effect Stripe production probe passed these checks on
head commit `218f40ab0ab231941eba35eb905d30a9ffb9cdcb`:

- the configured Stripe secret key can read live-mode account and balance data.
- the platform account reports charges and payouts enabled.
- an enabled Stripe webhook endpoint points at the production `stripeWebhook`
  Cloud Function.
- Stripe Connect return and refresh URLs are configured as HTTPS URLs on
  `app.sportgreenmoove.be`.

## Blocking Finding

The stricter probe failed when it checked the read-only Accounts v2 list
endpoint used by the app's Stripe Connect onboarding path:

> Accounts v2 is not enabled for the live merchant.

The app code creates driver connected accounts through Stripe Accounts v2
(`/v2/core/accounts`) and account links through `/v2/core/account_links`.
Until the Stripe dashboard enables Accounts v2 or the product formally changes
its Stripe Connect account strategy, `stripeConnect` must remain pending in the
release evidence manifest.

## Required Follow-Up

1. Enable Accounts v2 for the live Stripe merchant or complete the Stripe
   Connect platform setup requested by Stripe.
2. Re-run `npm run validate:stripe-production-readiness` in GitHub Actions or
   another environment with the production Stripe secrets.
3. Only after the strict probe passes, mark `stripeConnect` as
   `production-configured` in `docs/release/evidence-manifest.json`.
