# Live User-Flow Smoke Evidence - 2026-06-17

## Scope

These checks ran against the production Firebase project
`sports-green-moove-prod` from the current PR worktree. The scripts created
disposable production users and records, verified the user flows, then cleaned
up their own data.

The commands required `CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11` because
the local default Google Cloud SDK Python cannot load SSL.

## Backend Flow

- Command: `CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 npm run smoke:live-backend-flow`
- Result: passed
- Run id: `codex-smoke-2026-06-17T22-09-51-162Z-373f27f6`
- Published trip: `bHat2wTxvyoVw5V4LPdW`
- Search matches: 1
- Approved booking: `10WmJyi07kdvFukIg3cM`
- Completed ride: `o7qi2HuUhXNrwCupzuPb`
- Child native fallback user: `HuVyLtGaaRhsw6doZ4Z21mQ2KZC2`
- Chat messages: 1
- Ratings: 1

## Operations Flow

- Command: `CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 npm run smoke:live-operations-flow`
- Result: passed
- Run id: `codex-ops-smoke-2026-06-17T22-11-41-606Z-029cf779`
- Requested membership: `04UIZtNu74O6cEKHSRWqUTxCZBl1_codex-ops-smoke-2026-06-17T22-11-41-606Z-029cf779-club`
- Reviewed report: `boATYkKEOoQngoYuUDC3`

## Remaining Evidence

These smoke checks do not replace physical real-device tracking scenarios,
Radar webhook delay evidence, Stripe payment reconciliation evidence, or the
final safety-audit export.
