# Controlled Recovery Screens Passed; Full Checks Remain Red

Reviewed **2026-10-17**. Execution occurred **2026-10-16** at source
`f751bcf9830fbf3440510fe65da9d0e7cc02ce19`.

Native [38975754188](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38975754188)
records **77 ordinary component cases, zero failures/errors and 16 intentional
skips**. All four `SessionRestorationFlowTest` cases ran without skips/failures:
loading without login actions, failed restoration followed by one explicit retry,
explicit disconnect, and reachable controls at 320 dp with 1.5x text. Both original
component screenshots were reviewed: text and both actions fit; no provider,
credential or exception details are shown. These are **controlled gateway screen
tests**, not a real expired token, physical phone or full application recovery.

The subsequent isolated app run `ae0c13eefc16a49e6692563d0df2921a` completed the
driver cancellation stage, then confirmed-message restart and controlled reply
loss. Its strict restart receipts and independent saved-data record show three
read messages. This does not prove the earlier authentication stream error's
transport cause or reproduce that error during rotation.

The full run still **failed** during network preparation. The retained receipt
has no valid default data subscription, no cellular availability callback, only
Wi-Fi and an empty network-stage array. It never reached the intended cutoff.
There is no final completed `results.json`; no offline send or persisted network
outcome is inferred from the earlier stages or successful component suite.

Web Smoke [38975754106](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38975754106)
also **failed**: 23/24 service groups, with the acceptance/cancellation race
returning `INVALID_ARGUMENT: Transaction is invalid or closed` from a transaction
query. The supplement group passed. `service-failure-excerpt.txt` retains three
selected, otherwise unmodified original job-log lines: the error stack, failed
group and final count. This is an excerpt, not an invented complete JSON report.
The full job log remains linked above and in the local downloaded diagnostics.

Inconsistent transaction read/lock ordering is an investigation lead, not an
established fix: cancellation reads trip then booking queries, whereas approval
reads booking then trip. Inspect all affected payment/change/cancellation
transactions before choosing a consistent order. Do not accept `INTERNAL`, add
blanket retries or call a later green run a root-cause explanation.

Ten original or explicitly selected excerpt artifacts are SHA-256 pinned.
Backend, readiness and unit success do not override these two full-run failures.
No production deployment, physical tracking, real payment/refund, push or release
manifest item is accepted. The overall goal remains active.
