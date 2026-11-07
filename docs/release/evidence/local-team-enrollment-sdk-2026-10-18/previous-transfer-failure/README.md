# Previous Copy Failure: Device Connection Offline

[Native CI 39171826718](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39171826718)
failed at `d195205cdffaf8b557fca212e9d19b7f25689216`, before the new connected
team-enrollment case was added. Local run: `08c6a2bd92fbf46004a32c7c6d85293d`.

The original ordinary XML contains 143 cases, 33 skips and no failures/errors.
The suite receipt retains ordinaryTests=0, componentEvidence=0, localReplay=1.
The named primary `trip-change-schedule` transfer failed with status 1, no signal
and no client error code; it remains incomplete. No whole-replay result exists.

Newly available bounded diagnostics distinguish the failure from a filename or
directory parse problem. Directory stat, shell listing and sync listing all
returned `device offline`. The device log records its host connection terminating
with a write failure and subsequently being authorized again. This establishes a
temporary debug-transport outage, not why the underlying connection dropped.
No copy retry, alternate collection or larger deadline has been added.

Store restoration is verified with the same service runtime. This failure is
separate from the earlier ordinary-suite interruption during a service update.
Neither successful restoration nor a later cleanup copy repairs the failed
primary transfer. Five original artifacts retain their SHA-256 hashes. No new
team native execution, physical-device or release readiness is accepted here.
