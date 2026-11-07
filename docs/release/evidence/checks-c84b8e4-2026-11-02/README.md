# Source-Bound Automated Recheck

Source: `c84b8e4a96f2f35d0b92f68b13904740b14d0dd3`, first attempts, 2 November 2026.

- [Main native job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41531744223/job/125573411082): success, 248 ordinary passes / 55 skips / no failures, 37 connected replay groups / 40 native cases, 17 successful primary copies. Device restoration and host exit are independently recorded.
- [Separate chat-network job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41531744223/job/125573410973): failure during network preparation, before disconnection or message sending. No default data subscription is observed; Wi-Fi reaches the isolated backend. This is a prerequisite observation, not the subscription selection's root cause or a completed message exchange. Both network requests are released, device restoration and host exit verified.
- Ten of eleven focused jobs pass; their required safety aggregator fails. The whole native gate does not pass.
- [Main web job](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41531744084/job/125573409996): cancelled. The authoritative annotation records its existing 30-minute deadline. Every listed step is successful, including uploads and post actions. The last available log line is `2026-11-02T22:11:18.7835144Z Cleaning up orphan processes`; the cloud job completes cancelled at 22:18:58 UTC. These observations do not identify whether cleanup, final reporting, connectivity or another host condition caused the incomplete conclusion. The web required aggregator fails; successful step records are not a whole-job pass.

The complete original main and chat ZIP sizes and SHA-256 values match the server
artifact metadata before selection. `archive-verification.json` binds every
retained original member to its archive. Original screenshots and full logs are
not published. The last web log line and digest are retained without raw command
environments. `head-checks.json` records 20 successes, three failures, one
cancellation and six intentional skips before any diagnostic retry.

The user separately approved one web-only diagnostic retry with debug logging.
It uses the unchanged source/tests/deadline and is tracked as attempt two of the
same run, not an erasure or acceptance of attempt one. No Android or physical
phone retry, provider request, test-data privilege change or deployment occurs
as part of that diagnostic authorization.

Public update: one concise simulation note, corrected latest capture description,
all 34 flow objects/media/tours/phone dates unchanged, same public audience.
Earlier failed copy bundles remain intact. Capture intermittency, parent approval,
physical tracking, provider delivery, production and release readiness remain open.

Existing `tests/parent-approval-input-stop.test.mjs` and current portal validation
cover this boundary, including rehashed contradictory reports. Web Integration
Smoke already runs that test command and watches `scripts/qa/**`, portal content
and this evidence tree. No workflow workload, deadline, fallback, infrastructure
or Terraform change is needed.
