# Team Enrollment Choices And Android Screen Source

`choices.json` retains 12 actual isolated transport groups for paged club/team
choices and currently verified children. They are not native screen evidence.
`build-checks.json` binds 16 actual Android unit cases and the compiled test APK;
the four new native component cases are compiled, not yet executed. No screenshots
or end-to-end team enrollment result are accepted from compilation.

## Authority And State

Choices are server-read in transactions, never copied from the app's old profile
or roster snapshot. Club/team context and cursors bind the signed-in account;
child choices also bind the team's immutable server identity. Missing/unknown or
closed club/team states do not grant access. Child choices require separate
current manager verification, the declared link and both active memberships.
Recreated children cannot inherit old verification. A renamed team keeps its
cursor; a recreated team cannot reuse it.

Pages scan at most 20 records plus one lookahead. An empty filtered page with a
next cursor is not called the end of the list. Synthetic pagination fixtures
include 24 teams and 21 children; the children's guardian requests and manager
verification are actual local callable transitions, not native or production
approvals. Missing labels stay null. Choice reads create no team enrollment,
approval, audit event or role change.

The Android Groups entry, self/child selection, fresh review, confirmation,
request/withdrawal and visible status are now wired in source. Only a displayed
view instance can submit; identity, revision and allowed action are rechecked by
the gateway and server. A lost reply clears actions and requires an explicit
read, not another automatic write. An acknowledged receipt is not called unsent
if its later read fails. Background/account disposal clears names, choices and
pending responses. Selection is not persisted; the user reselects after returning.

The four component cases explicitly use an in-memory gateway. Their future images
must remain labeled simulated until a separate SDK-connected run proves real
storage, manager approval and parent refresh together. No real device or group
chat claim follows from them.

## Previous Full Replay Still Failed

`previous-run-interruption/` retains five original artifacts from Native CI run
`39162015539`, source `351aa4d571d2de3e0df670b4bff906250523a9e0`, local run
`d5375b51c7c7ddf126b458eddf93a8c3`. The ordinary suite had 106 executed passes,
33 intentional skips and no failures. Its full local replay nevertheless failed
the primary `trip-change-parent-confirmation` copy with status 1. Successful
restoration does not repair that failure or accept a whole 35-group run.

The old read-only diagnostics retained only exit codes for failed stat/list
commands. The collector now records bounded, credential-redacted stderr and
distinguishes command failure from parse failure. This is a diagnostic change,
not a retry, substitute transfer, permission change or proven repair.

## Remaining

Execute and visually inspect the four component cases at narrow/large-text and
normal sizes. Then add authenticated SDK replay, manager-facing team review and
owned-request history, including retired teams and lost eligibility. Team chat,
physical-phone use, process-restart recovery and production deployment remain
unimplemented or unverified. Existing enrollment/guardian authority remains
separate. No infrastructure change or Terraform resource is needed.
