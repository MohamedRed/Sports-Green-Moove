# Completed Parent Request Stage

Actual Android emulator/SDK run `dcaf30b6b6b5e66753fa2709163d44a8` completed
the parent-request stage at 2026-10-18 17:47:29.080 UTC on source
`5d89788e2b4db440ad65c1575cc072acdf3f8030`.
GitHub run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39150235114
Artifact `android-connected-ui-test-results`, ID `12145836110`.

`guardian-parent-results.json` is the unchanged generated report, SHA-256
`eb5ba17a72f560ac4781819b05e7cb7913a70c0eb05b088355182f5021d91838`.
The actual transcript reports one passing local app case. The same-run device
marker, five original PNG hashes and successful **primary** collection receipt
were validated independently. The report was emitted only after server-side
verification of eight immutable transitions, exact actors and revision 8/revoked,
plus unchanged protected data and parent roles. Current parent module hashes match.

The app test covers cancelled confirmation without a write, request/pending,
manager refusal and reopen, manager verification, activity recreation/fresh
history read, parent withdrawal/reopen, manager revocation and account isolation.
Manager decisions in this run use a separate authenticated local SDK session,
not the management browser UI. That browser has separate retained evidence.
All accounts, child names and club data are isolated QA fixtures. Five original
captures were visually reviewed; there are no credentials or real child records.

Separate earlier evidence remains unchanged:
`../local-guardian-parent-2026-10-18/README.md` (parent services/unit checks),
`../local-guardian-review-2026-10-18/README.md` (management browser),
`../local-membership-refresh-2026-10-16/README.md` (native membership decisions),
and `../local-team-ownership-2026-10-16/README.md` (team ownership denials).

Activity recreation is **not** full process termination or physical-device
verification. iOS, physical-phone replay, child/team enrollment and team chat
remain incomplete. These audit events are verification decisions, not release
tracking-consent evidence. No production record or personal contact was changed.

## Whole Run Remains Failed

The scoped stage does **not** make the entire run green. Retained original
`full-run/native-suite-status.json` reports ordinary=1, component-copy=0,
local-replay=1. Ordinary trip-change instrumentation crashed around a screen
capture; the local replay later timed out preparing the network-loss case at
its unchanged 30-second deadline, before the intended outage assertions.

Store restoration occurred, but verification failed because the map-services
runtime changed from 24.23.35 to 26.40.32 during the run. Location and map services
remained enabled. This is an observation, not proof that the update caused each
failure. The original restore receipt records restored=true/verified=false.
There is no complete 34-group/36-case result. No deadline, capture assertion,
network test or restoration requirement is waived by retaining this scoped proof.
