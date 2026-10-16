# Native Membership Refresh

Implementation and local checks dated 2026-10-16 UTC. The full device replay is
pending; do not treat compilation or unit tests as accepted screen evidence.
No production data, roles, provider transactions or paid resources are changed.

## Root Cause And Change

The Groups route displayed only the whole-app snapshot. There was no refresh
control, and returning to the route did not reload an externally reviewed request.
The new account-scoped route reads the server on entry/resume and explicit refresh,
distinguishes loading/errors from empty results, and serializes membership requests.
Uncertain writes require an explicit read before another action. Acknowledgement
is retained if the subsequent read fails. Old account/route responses are ignored;
a slow whole-app snapshot cannot undo the newer club result in the profile.

The unused request helper is removed. The inert "Voir" and "Créer un nouveau
groupe" texts were not functional actions and are removed rather than presented
as working features. Club details/creation and group conversations remain open.
The previous 50-club/50-membership query bounds are unchanged; broad directory
pagination is not proven by this change. No new indexes or Terraform are needed.

## Local Verification

`groups-state.xml`: nine controller cases, including request ambiguity, repeated
actions, old response/error suppression and cancellation. `app-data-state.xml`:
six whole-app cases, including a newer club result surviving a slow app snapshot.
Android unit tests and the instrumentation APK compile locally.

The new native replay case requests two memberships through the real app, then
uses separate authenticated local manager SDK calls for approval/refusal. It
refreshes the parent screen, re-requests after refusal, refreshes a later approval,
recreates the activity and checks another account. Independent record checks
require two active memberships, exactly three matching audit/notification pairs,
unchanged parent roles and counters incremented once per approval. These manager
decisions are not native management UI proof. Three component layout cases cover
loading/error boundaries and 320dp with 1.3x text, separately from the real replay.

The current isolated runner requires 16 instrumentation cases and 17 coverage
groups. Screen captures and result JSON will only be accepted after an actual
completed run. Physical devices, push delivery, network recovery, child enrolment,
team assignment and complete club discovery remain unverified. No final release
manifest acceptance is changed.

## First Replay And Reviewer Session

[Run 38853625167](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38853625167)
at `4ed57e8` passes the general component suite: `general-ui-passed.xml` records
64 cases, zero failures/errors and 11 intentional skips. The three Groups layout
cases pass, including 320dp/1.3x text. The original XML is retained compressed;
the readable copy normalizes only CRLF and trailing spaces in diagnostic lines.

The isolated membership case reaches its second manager-session creation and
fails with `FirebaseApp was deleted` inside `FirebaseAuth.useEmulator`. The helper
created/deleted a separate reviewer app for each decision; the second setup still
encounters the deleted instance in SDK emulator configuration. No complete
16-case result was produced. `reviewer-session-failed.txt` removes only extra
terminal blank lines; the compressed original is unchanged.

The reviewer now has one explicit lifetime across all three decisions, with
emulator setup/sign-in once and cleanup at the end, including setup-failure
cleanup. App-side requests, refresh/re-request/recreation/account assertions,
independent audits and strict case counts remain unchanged. A full replay after
this harness correction is still required. The separate web smoke failure was
an old current-run expectation of 15 cases, not a changed historical receipt;
that expectation now includes the new case while original evidence stays intact.
