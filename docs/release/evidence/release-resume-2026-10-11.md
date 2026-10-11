# Release Verification Resume - 2026-10-11

## Checkout Recovery

The Codex checkout's Git link pointed at metadata in Documents that macOS File
Provider had offloaded (`compressed,dataless`). Reads timed out. Source files
remained accessible.

Git metadata was recovered from the canonical GitHub repository into local
Codex storage outside Documents. Rebuilding the index at `01818a7` showed no
local modifications. The checkout was then advanced to the current PR branch
head, `2e4b3d914ba54400271a4f99efc052add94f57a9`.

PR #1 remains open. Its July 9 checks passed, with iOS jobs skipped. Those
historical checks do not prove October provider health.

## Current Stripe Verification Gap

The June 18 change moved onboarding to Connect Express v1 and recorded Connect
API access as configured. The earlier Accounts v2 blocker is historical.

The configured callback host recorded in that evidence, `app.sportgreenmoove.be`,
currently returns `ENOTFOUND` from the local DNS resolver. In the same check,
`api.stripe.com` and `sports-green-moove-prod.web.app` both resolved normally.
An HTTPS request to the callback host also failed DNS resolution.

The existing probe checked callback URL syntax and webhook URL substrings only.
Its PR invocation could return success after any verification error through
`--allow-pending-provider`. That bypass has been removed.

The strict probe now requires:

- live Stripe API access and enabled platform charges/payouts;
- live Connect v1 account-list access;
- enabled live webhooks targeting the exact production function URL;
- all payment, account-update, and transfer events handled by the backend;
- reachable HTTPS return and refresh callbacks.

Stripe remains pending until these checks pass with the current production
configuration. The HTTP check establishes callback reachability; completing
driver onboarding and a paid ride still requires separate user-flow evidence.

## Remaining Release Work

The manifest still requires all nine tracking scenarios on physical iOS and
Android devices, and all six safety-audit event categories. Prior BrowserStack
UI smoke results and App Live uploads do not prove those tracking scenarios.

No provider credentials or customer data were exported during this resume.
