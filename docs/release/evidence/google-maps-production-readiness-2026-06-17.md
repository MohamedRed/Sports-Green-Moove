# Google Maps Production Readiness - 2026-06-17

## Scope

This evidence records non-secret production Google Maps Platform readiness for
the Android email/password release scope. It does not contain API key values.

## Result

- Environment: production
- Firebase/GCP project: `sports-green-moove-prod`
- Project number: `912388695601`
- Checked at: 2026-06-17T22:36:08Z
- Checked by: Codex
- Result: production-configured

## Provider Evidence

The production project has the required Maps Platform services enabled:

- `maps-android-backend.googleapis.com`
- `maps-ios-backend.googleapis.com`
- `places.googleapis.com`
- `routes.googleapis.com`

Production provider secret validation also passed on the current PR head:

- Workflow: Release Readiness
- Job: Production provider secret validation
- Head commit: `98c1b78dfd5d2862c66cc9d28210d39c85fefa92`
- Job URL: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27723564812/job/82014614800
- Conclusion: success

## Live User-Flow Evidence

The production backend smoke exercised the `searchTrips` user flow against
`sports-green-moove-prod` and returned a matching trip. The deployed
`searchTrips` callable attaches the `GOOGLE_MAPS_API_KEY` Firebase secret and
uses `GoogleRoutesProvider`, which calls Google Route Matrix and Compute Routes
for trip ranking and route preview data.

- Evidence file: `evidence/live-user-flow-smoke-2026-06-17.md`
- Run id: `codex-smoke-2026-06-17T22-09-51-162Z-373f27f6`
- Search matches: 1

## Limitations

API key string values were not read, printed, or committed. API key restriction
metadata was not exported because the local ADC quota project blocks the API
Keys REST API, but the release-readiness secret validation and production
Google Routes user-flow evidence prove the configured production key path works.
