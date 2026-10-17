# Dual-Transport Local Replay

## Retained Failure

The original `before/` files are from commit
`8605f03cac004a077ca64dfc2b702918c368e45b`,
[Native CI run 39027732292](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39027732292),
local run `06c381463bccc56a41689db4cd82c01a`. The ordinary 95-case report has
76 passed, no failures/errors and 19 conditional local-backend skips. All seven
trip-change cases and the three cancellation component cases passed. The separate
full native/backend replay later failed in network preparation, before a cut or
offline send. It must not be recorded as a complete 24-group pass.

The app's initial and terminal preparation snapshots show enabled Wi-Fi and
mobile-data switches, a reachable isolated backend and **cellular-only** internet.
The SIM was loaded, default-data subscription valid and cellular data connected;
the callback arrived. The modem and subscription summaries corroborate this.
Zero default-selection history entries mean unavailable history, not readiness.
This failure is not the earlier missing-SIM condition. The retained transcript
shows the unchanged 30-second preparation timeout at line 75.

The unaltered native display capture also has black map areas. It is diagnostic
only, not approved for the partner gallery. The black areas are present in a full
display image, not only the earlier Compose export. Map rendering remains open.

## Current Change

The [version-2 protocol](../../../contracts/local-network-handover.md) explicitly
requests both required internet transports. It records the exact Wi-Fi-default
observation before the cut and after restoration, releases both callbacks, and
retains the original wait limits, offline send, retry and saved-message checks.
The missing Wi-Fi request is corrected; the completed runtime result is below.
This does not establish that all older setup failures share this cause. No SSID, route,
subscription, validation state, provider configuration or production data is forced.

## Completed Version-2 Replay

`completed/` retains the original output of commit
`74e568d416daf4991c83f6bf65c272c78e78d691`,
[Native CI run 39029499127](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39029499127).
Run `ff75301b1aaf2f96a48b464854dbc1d8` completed at
`2026-10-17T11:56:26.968Z`: all 24 native/backend cases and 24 groups passed.
The 16 original instrumentation transcripts contain those 24 cases. The separate
ordinary report declares 99 cases: 80 passed, no failures/errors and 19 conditional
local-backend skips. All four new observation/cleanup cases, seven trip-change
cases and three cancellation component cases executed successfully.

The recorded states prove Wi-Fi default plus cellular availability, exclusive
cellular handover, no active/internet network with an unreachable backend, and
restoration to Wi-Fi default plus both transports. Both requests were released.
The draft survived, explicit retry persisted one parent message, and the driver
replied. Independent saved-data checks found exactly two messages and two read
notifications with no duplicate intent. The receipts also retain confirmed
process-restart, booking recovery, reply-loss and all five successful host copies.
Two unaltered message screenshots were visually reviewed for the private portal.

This single passing version-2 run does not prove that every previous SIM/default
selection or startup failure is resolved. Repetition, draft process-death,
real send-time cuts, physical tracking, provider/payment outcomes and the six real
safety-audit events remain open. Historical version-1 runs and the failed `before/`
artifacts stay unchanged. No release-manifest requirement is accepted by this
report. The full goal remains active.
