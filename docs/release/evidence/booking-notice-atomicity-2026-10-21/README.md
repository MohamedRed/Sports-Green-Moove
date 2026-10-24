# Booking Decisions And Notification Writes

Approval, decline and cancellation previously committed booking/capacity changes
before writing a separate notification batch. Inspection of the retained legacy
source establishes a commit gap: a later notification-write error cannot roll
back the booking. This is not a claim that a real customer lost a notification.

The correction creates one deterministic recipient/event/booking notification
inside the decision's Firestore transaction. A notification write conflict now
aborts the same transaction, including capacity changes. Replays keep existing
precondition semantics and cannot reset an already-read notification or create
another seat change. Existing unrelated notification producers remain unchanged.

## Executed Scope

The pre-change run fails the new deterministic write-conflict contract before
any passing scenario. The old path used random notice document IDs and therefore
did not conflict with the prepared deterministic guard. This is a regression
contract comparison, not simulated network loss or a reproduced cloud outage.
Its incomplete report and exact source bytes remain retained separately.

The final corrected run passes twelve isolated authenticated-service scenarios:
write conflicts for all three decisions leave booking and capacity unchanged;
successful decisions commit exactly one intended notice; replays make no extra
writes; a read notice stays read; two concurrent approvals have one winner; and
the inbox returns two intended parent notices, one driver notice and none to an
unrelated account. All 158 protected records and original actor claims remain
unchanged. Both disposable environments are destroyed and their four service
ports refuse connections. Source bytes are archived by digest.

These are service/storage checks only. No new phone screen, push notification,
payment, provider request, production deployment or release requirement is
accepted. The earlier phone booking screenshots retain their original scope.
Driver acceptance/refusal and notification display still need a phone replay.

## Broader Regression Remains Incomplete

The later 24-group local replay reaches nineteen passing groups, including
reservation decisions, before two generic Firebase CLI errors interrupt it.
The five remaining groups report failure and no final service report is written.
The exact error cause is unproven. Available disk space was independently observed
at 293 MiB, which is a constraint, not proof of that cause. Two owned orphaned
database processes were stopped with SIGTERM and all four ports were verified
available afterward. `regression-interrupted.json` retains that negative scope.

A contract batch initially overlapped that backend and five tests could not bind
port 5001. This was a test-orchestration conflict, not a product assertion failure.
After disposal, the unchanged serial contract batch passes all 1,223 checks.
All 376 Functions unit cases pass separately. Neither substitutes for the
unfinished full service replay, physical replay or current-head CI.
