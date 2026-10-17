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
The missing Wi-Fi request is corrected; the exact underlying OS cause and a
successful complete replay still require runtime evidence. No SSID, route,
subscription, validation state, provider configuration or production data is forced.

Host validation tests and compilation are not a substitute for executing the four
new native observation/cleanup cases or the complete connected replay. Historical
version-1 runs stay unchanged and cannot satisfy the fresh version-2 verifier.
No release-manifest requirement is accepted by this report. The goal remains active.
