# Radar Production Readiness - 2026-06-18

## Scope

This evidence records the human dashboard confirmation that the production Radar setup for Sports Green-Moove is configured for release-provider readiness.

No Radar secret values, API keys, webhook signing secrets, or dashboard screenshots are included in this repository artifact.

## Human Confirmation

- Confirmed by: Mohamed / SGM owner in the SGM Telegram release thread
- Confirmed at: 2026-06-18T15:40:07Z
- Confirmation received: “i confirm the Radar setup”

## Configuration Scope Confirmed

The confirmation covers provider-readiness setup for the production app:

- Production Radar app/setup exists.
- Production native publishable key is configured in GitHub Actions as `SGM_RADAR_PUBLISHABLE_KEY`.
- Production webhook signing secret is configured in GitHub Actions as `RADAR_WEBHOOK_SECRET`.
- The Radar webhook is configured for the production Sports Green-Moove backend.

## Supporting Automated Evidence

- Provider secret validation passed for Radar secret/key shape in GitHub Actions:
  - https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27723564812/job/82014614800
- Latest Release Readiness provider job also passed on the release branch:
  - https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27769790839

## Residual Risk

This clears the **provider setup/readiness** blocker only.

It does not replace the remaining release evidence gates:

- a real Radar webhook event in the final safety-audit export,
- Radar-delay real-device scenario evidence,
- iOS and Android physical real-device run evidence.
