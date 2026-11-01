# Current-Device Team Alert Authority

On 1 November 2026 the isolated local callable trial passed sixteen cases against
real local Auth, Firestore and Functions services, using synthetic phone tokens.
The exact tested sources are hashed in `services.json` and retained in the shared
source archive. The runner verifies unchanged sources before/after execution,
protected fixtures, closed admin clients, destroyed disposable data and all four
local endpoints closed. No production records or real accounts were used.

`resolveTeamPushAlert` validates the authenticated adult's current server account,
private installation proof, revision, active binding and reverse token index. It
then reuses the existing notification authority check for the actual message,
current team instance, current adult/child memberships, guardian verification and
current-admission history boundary. Rotation, account transfer, sign-out, revoked
and renewed authority, removed messages and malformed bindings are exercised.
Read display is suppressed; a still-authorized open remains possible. Neither
operation acknowledges messages or modifies alert state. Only generic text and
the validated team reference are returned, never private message content or a URL.

Local build and all 589 function unit cases also pass, including eighteen strict
request cases. The sixteen callable cases are the retained behavioral evidence;
unit/build success is not native execution. Web Integration Smoke now repeats
and retains this separate suite alongside the existing alert/registration suites.
No infrastructure provisioning or Terraform change is required for this callable.

This is preparation, not a completed closed-app flow. There is no dispatcher,
native notification display/tap consumer, real messaging token, provider send,
phone receipt or production deployment in this trial. Native lifecycle/account
revalidation and actual delivery/tap/permission/revocation/sign-out phone trials
remain required. All six operational push evidence requirements stay pending.
Physical tracking, safety audit and other release gaps are unchanged.

Publish only a short local-result note. Preserve the public Site audience, every
existing video/image/tour and historical phone date, and the partial team-flow
status. This trial produces no new screenshot or recording.
