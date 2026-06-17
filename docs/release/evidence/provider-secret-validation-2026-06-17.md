# Provider Secret Validation - 2026-06-17

## Scope

This evidence records structural validation of production launch provider secrets
from GitHub Actions. It does not prove provider dashboard restrictions,
webhook delivery, real-device behavior, or payment settlement.

Postponed Google Sign-In and Meta Facebook Login secrets are intentionally out
of scope for this Android email/password release validation.

## Result

- Workflow: Release Readiness
- Job: Production provider secret validation
- Head commit: `98c1b78dfd5d2862c66cc9d28210d39c85fefa92`
- Workflow run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27723564812
- Job URL: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27723564812/job/82014614800
- Started at: 2026-06-17T22:23:23Z
- Completed at: 2026-06-17T22:23:29Z
- Conclusion: success

## Secret Inventory Refresh

- Source: `gh api repos/MohamedRed/Sports-Green-Moove/actions/secrets --jq '.secrets[] | [.name, .updated_at] | @tsv'`
- Refreshed at: 2026-06-17T22:36:13Z
- Result: all production launch provider secret names required by
  `scripts/release-evidence-requirements.mjs` are present in GitHub Actions
  repository secrets.
- The checked-in inventory records names and last-updated dates only; it does
  not include secret values.
- Still absent by design for this Android email/password release: postponed
  Google Sign-In and Meta Facebook Login secret names
  (`SGM_GOOGLE_REVERSED_CLIENT_ID`, `SGM_FACEBOOK_APP_ID`,
  `SGM_FACEBOOK_CLIENT_TOKEN`).

## Validated Providers

- Firebase Android, iOS app config, and admin web config secret shape.
- Google Maps server, Android SDK, and iOS SDK key shape.
- Radar webhook and native publishable key shape.
- Stripe live secret key, publishable key, webhook secret, and Connect return
  and refresh URL shape.

## Stripe Connect Probe

The no-side-effect Stripe production probe was added after the secret-shape
validation. It proved the live key, platform account, Stripe webhook endpoint,
and Connect return/refresh URL shape, then a stricter follow-up found that
Stripe Accounts v2 is not enabled for the live merchant. The runtime driver
onboarding path uses Accounts v2, so Stripe Connect remains pending until the
provider dashboard is updated or the payment account strategy is formally
changed.

## Remaining Evidence

Secret validation alone is not enough to mark a provider
`production-configured`. Firebase is backed by separate production live-smoke
and Hosting evidence. Google Maps Platform is backed by separate production API
enablement and live Google Routes user-flow evidence. Stripe Connect still needs
Accounts v2/Connect enablement before it can be marked configured. Radar still
needs provider dashboard or live-run evidence before it can be marked
configured.
