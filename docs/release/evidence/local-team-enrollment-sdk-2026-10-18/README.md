# SDK-Connected Team Replay Preparation

`fixtures.json` retains six actual authenticated local service groups. The
dedicated QA club, team, child and memberships are created without changing auth
claims or unrelated fixtures. The parent requests verification and the manager
verifies it through two real local transitions; no verified record is preseeded.

The lifecycle verifies five self-enrollment transitions (request, refusal, new
request, approval, withdrawal), three child transitions (request, approval,
manager revocation) and the separate guardian revocation. A stale approved-child
withdrawal is denied without another team event after guardian access is lost.
All eight team audit actors/revisions and three guardian events are independently
checked. Duplicate fixture preparation and wrong enrollment identities are denied.
Scoped cleanup restores the prior records and claims. Only the parent and driver's
normal sign-in timestamps may advance; every other profile field is compared,
and the manager's profile remains entirely unchanged. This is service and
fixture proof, not native screen execution.

`build-checks.json` binds the original local build log, 16 re-executed team unit
cases, fixture result and seven relevant replay sources. The emulator-profile app
and test APK compile. No new native action or screenshot is accepted from a build.

`LocalTeamEnrollmentFlowTest` is now appended to the mandatory full replay. The
matrix becomes 36 groups / 38 instrumented cases; all earlier groups remain. It
uses the real app entry, selections, confirmations and production SDK gateway with
isolated endpoints. Manager refusal/approval/revocation use a separately signed-in
local SDK peer, not a manager screen. A named primary capture transfer, ten exact
checks, five hashed images, independent persisted verification and successful
fixture cleanup are required before a team result can be emitted.

Activity recreation deliberately requires reselecting the team; it does not prove
full-process restart or owned-request history. The previous two published team
screenshots still use simulated responses. A connected native run, review of its
new captures, manager-facing review/history, team chat, physical devices and the
explicit tracking/safety/payment release requirements remain pending. No production
data, paid provider request or infrastructure change is involved.
