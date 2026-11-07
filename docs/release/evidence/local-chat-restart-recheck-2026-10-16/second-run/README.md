# Restart Stage Passed; Full Replay Failed During Network Preparation

[Native run 38970530548](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38970530548)
tested source `87ea87b9258e2ae060e000a7f3b80dfedbd89052` on **2026-10-16**.
The isolated run is `36b241fed563bc222c20e4cb9a92a7bc`. This is a failed full
replay with separately verified earlier stages, not an accepted complete run.
No `results.json` was produced or reconstructed.

## Independently Verified Stages

The strict current restart verifier accepts the original before/stop/after
receipts, including both confirmed input phases. The process changed from 6674
to 6799 after an independently verified force-stop. The parent remained signed
in, found the confirmed history, sent another message and received the driver's
reply. The persisted checkpoint confirms three distinct messages and three read
notifications, the expected parent/driver ownership and unchanged original
message identity/time. Both corresponding instrumentation stages passed.

The controlled reply-loss stage also passed its instrumentation and receipt
contract, including the rejected explicit retry and final recovery with the
same message/notification identity. Its server receipt records one original
message and notice throughout. This is an injected local transport case, not
the later operating-system disconnection test.

The confirmed-restart and response-loss evidence copies independently completed
with status zero, no signal/error and the same run identity. The final failure
cleanup copy is retained separately; it cannot substitute for a network-recovery
copy or complete the missing final replay verification.

The ordinary XML separately reports 73 cases, zero failures/errors and 16
intentional skips. Its successful component suite does not override the failed
local replay. Its local network test entry is an intentionally skipped earlier
invocation, not the failure transcript from the isolated application.

## Network Preparation Failure

The isolated network test failed at `LocalChatNetworkFlowTest.kt:74`, waiting
30 seconds for the existing required prepared state. Both preparation snapshots
show enabled Wi-Fi/mobile data, reachable local backend, SIM-ready state 5,
data state 0, no valid default data subscription, zero cellular availability
callbacks and only a Wi-Fi internet transport. Modem receipts before/after
still report home voice/data registration. Registration alone therefore does
not establish an available Android cellular data route in this run.

The network array is empty. No disconnection, offline send, retry, cross-account
draft check or subsequent independent persisted network check occurred. The
cellular request was released. The reviewed failure image shows the draft still
on the empty conversation before the intended disconnection, not a completed
send. It is retained here but is not partner success media.

This reproduces the earlier missing-subscription preparation symptoms. The
reason the disposable device lacks the default subscription remains unresolved.
The passing restart stage does not prove the cause of the previous missed
driver reply either. No radio/APN/subscription changes, timeout increase, skipped
case, automatic rerun or alternate network route was added.

## Scope And Publication

Twenty raw JSON/XML/transcript/image files are copied byte-for-byte and SHA-256
pinned. The reviewed app-only restart reply capture may be shown as a **local
stage recheck**, never as evidence that this full replay passed. Existing complete
historical run evidence remains unchanged and distinctly dated.

No production deployment/data, physical-device tracking, real payment/refund,
push delivery, unsent-draft process recovery, token expiry or team group is
accepted. The full release/user-flow goal remains active. Diagnose the missing
subscription before claiming reliable full replay completion; a later green
run alone must not erase this failure.
