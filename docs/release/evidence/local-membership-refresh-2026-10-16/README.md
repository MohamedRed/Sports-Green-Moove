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
