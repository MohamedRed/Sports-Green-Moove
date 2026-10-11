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

The fresh [Release Readiness production check](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38141082159/job/114474917484)
at `c39e5f2` failed with
`SGM_STRIPE_CONNECT_REFRESH_URL callback host app.sportgreenmoove.be could not be reached.`
This confirms the current Actions configuration still uses that host. The Stripe
API, account, Connect, and webhook checks completed before the callback failure.

Read-only Firebase Hosting inventory returned no custom domains for the production
site. Local DNS checks for the apex `sportgreenmoove.be` returned `ENOTFOUND` for
NS, SOA, and A records. Cloud DNS inventory was inaccessible (HTTP 403); that does
not establish whether zones exist. The owner did not recall the intended domain
or its DNS provider. No DNS, hosting configuration, or secret values were changed.
Independent A-record queries through Cloudflare (`1.1.1.1`) and Google (`8.8.8.8`)
also returned `ENOTFOUND` for both the callback host and apex domain.

Restoring DNS alone will not prove callback behavior. Stripe's
[hosted-onboarding contract](https://docs.stripe.com/connect/hosted-onboarding#handle-the-connected-account-returning-to-your-platform)
requires refresh callbacks to generate a new Account Link and return callbacks
to check the connected account's outstanding requirements. These behaviors need
end-to-end verification once the intended callback deployment is established.

## Disposable Smoke Cleanup

The live backend smoke previously deleted ride documents without deleting their
audit subcollections, suppressed deletion errors, and printed success before
cleanup finished. Cleanup now recursively deletes only this run's recorded ride
sessions, attempts all owned resource cleanup even after failures, detects partial
Auth deletion failures, and disposes Firebase clients even when cleanup fails.
Success is printed only after cleanup succeeds. Deterministic ledger IDs and the
child profile ID are recorded before their writes to cover partial-call failures.

## Fresh Production Backend Smoke

Run `codex-smoke-2026-10-11T13-00-39-867Z-3f8b433d` passed using disposable
accounts and a zero-price booking in `sports-green-moove-prod`. It verified three
auth profiles, trip publication and search (one match), driver approval, chat,
manual pickup/dropoff, driver and child native-fallback telemetry, parent and
child active-ride access, ride completion, and rating submission.

The [sanitized export](disposable-safety-audit-smoke-2026-10-11.json) was produced
at `2026-10-11T13:02:11.154Z`, before cleanup. It contains one completed ride,
two manual audit events, guardian consent, native-fallback source records, and
one CO2 bonus ledger entry. It includes no physical-device GPS capture, real
Radar event, or Stripe payment reconciliation. The strict audit validator fails
as expected with `radar_webhook_event` and `payment_reconciliation_event` missing,
and reports no secret-like fields.

The script reported `cleanup: complete`. Independent follow-up reads confirmed
zero remaining Auth users, zero remaining owned user/child/trip/booking/ride and
CO2/reward documents, zero ride audit subcollection documents, and no live-trip
Realtime Database entry. This is backend smoke evidence only; audit manifest
acceptance and physical-device scenarios remain pending.

## Remaining Release Work

The manifest still requires all nine tracking scenarios on physical iOS and
Android devices, and all six safety-audit event categories. Prior BrowserStack
UI smoke results and App Live uploads do not prove those tracking scenarios.

No provider credentials or customer data were exported during this resume.
