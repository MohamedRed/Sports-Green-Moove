# Stripe Callback Deployment - 2026-10-11

## Approved Primary Host

The owner approved using the existing Firebase Hosting domain instead of the
unresolvable `app.sportgreenmoove.be` host. Production callback URLs are now:

- `https://sports-green-moove-prod.web.app/payments/return`
- `https://sports-green-moove-prod.web.app/payments/refresh`

Both GitHub build settings were updated. Older APKs still contain the former
URLs and must be replaced by a newly built candidate; they are not evidence for
this callback change.

## Deployed Configuration

Scoped Firebase deployment created `stripeConnectReturn` and
`stripeConnectRefresh` (Node.js 22, second generation, `us-central1`) and updated
`createStripeAccountLink`. Hosting rewrites precede the admin SPA rewrite in
`firebase.json`. Other existing Functions were not deleted or redeployed.

Deployment used existing Google application-default credentials with an isolated
CLI configuration directory. No saved user credentials were replaced. The admin
was rebuilt using its actual production Firebase web SDK configuration, passed
only through the build environment. Its privacy route was preserved.

The deployment follows the repository's Firebase configuration and exported
Functions infrastructure model; there is no existing Terraform-managed Firebase
stack to modify. No manual DNS configuration or replacement domain was created.

## Verified Boundaries

- Return and refresh `?health=1` endpoints: HTTP 204, matching
  `X-SGM-Stripe-Callback` values, `Cache-Control: no-store`, and
  `Referrer-Policy: no-referrer`.
- Missing, malformed, and well-formed but unknown state: HTTP 400 with fixed
  French expired-link copy. The unknown-state check exercised the production
  Firestore lookup, rather than only rejecting malformed input before lookup.
- Public privacy route, admin root, and locally hosted fonts: HTTP 200.
- All 108 Functions unit tests passed, including 26 new domain/HTTP callback tests.
- Stripe readiness unit tests passed and reject ordinary SPA HTTP 200 responses,
  unknown callback destinations, incorrect route markers, and insecure redirects.
- All four UI states were checked at 1440x900, 390x844, and 320x568 with loaded
  fonts, no horizontal overflow, and non-overlapping text/control bounds. Desktop
  and small-mobile screenshots were inspected visually.
- Deployed callback pages were also checked at desktop and mobile sizes; fonts
  loaded and no horizontal overflow occurred. The production admin login was
  verified after Firebase Auth initialization at both sizes.

## Safety Properties And Limits

Only authenticated drivers can initiate onboarding for their stored account.
Callbacks carry an opaque 256-bit state, valid for 30 minutes; only its hash is
stored. Refresh generates a new Account Link, retaining the approved parameters.
Return reads Stripe capabilities and outstanding requirements before displaying
ready or pending status. It does not treat a redirect as successful verification.
No customer account details or credentials are rendered in callback responses.

These behaviors follow [Stripe's hosted-onboarding contract](https://docs.stripe.com/connect/hosted-onboarding#handle-the-connected-account-returning-to-your-platform).
Provider configuration and callback reachability do not prove a real driver's
completed onboarding, a paid booking, or a successful payout. No live Stripe
account was fabricated and no payment was charged during these checks. Physical
tracking runs and complete real Radar/payment safety-audit exports remain pending.
