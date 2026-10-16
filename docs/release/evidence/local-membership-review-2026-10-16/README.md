# Local Club Membership Review

Verified 2026-10-16 UTC with synthetic accounts under `demo-sgm-local-qa`.
No production users, role grants, provider transactions or paid resources were
changed. This does not complete the overall release/user-flow goal.

## Service And State Checks

`services.json` is unchanged output from isolated run
`2a04ab28b78bb997b952178688dd536b`, completed at `2026-10-16T03:02:12.108Z`:
all 16 groups pass. The new `membership-review` group verifies:

- Ordinary parents and foreign/requested managers cannot list or decide another
  club's requests. Disabling an active manager immediately denies further calls,
  even with a still-valid global role token.
- Concurrent approval by manager/admin produces one decision, one counter
  increment and one matching audit/notification pair. A repeat is rejected.
- Rejection does not increment the counter. Re-requesting clears current reviewer
  fields; a dialog for the old document revision is rejected. The new request can
  be accepted. The applicant remains an ordinary member, with unchanged Auth roles.
- All 25 seeded historical memberships and 26 managed clubs are reached through
  scoped pages without duplicates. Foreign/malformed cursors are denied.
- Missing club counters fail closed rather than inventing zero. Three accepted
  service decisions create exactly three reviews and three addressed notifications.

Original reports: `controller-passed.xml` has nine controller cases;
`domain-passed.xml` has four policy/cursor cases; `native-state-passed.xml` has
three membership-display cases. Full backend unit tests pass 138 cases. Android
unit tests and the instrumentation APK compile locally. The native regression
prevents refused/inactive memberships from becoming "My clubs" through a role
label, while retaining the pre-existing explicit legacy active-flag contract.

`rules-passed.xml` records the full 16-case rules run, including three new manager
boundaries. Requested memberships cannot become management authority, active
managers cannot bypass audited decisions with direct membership writes, and
disabled managers lose scoped reads. Unrelated existing rules checks still pass.
The readable XML removes only trailing spaces from emitted diagnostic log lines;
`rules-original.xml.gz` retains the unchanged original report. Test outcomes and
diagnostic text are otherwise unchanged.

## Manual Management Replay

`ui-results.json` is a curated record of actual browser interactions, not generated
instrumentation. Its five group IDs are coverage labels, not five automated tests.
Local session `45fcd4490c879c7ea44cd7bbe239d043` used the actual management site
and local services:

1. Sign in as the disposable club manager. Only its club is offered. Open Camille
   QA's approval dialog and dismiss it. `dismissed.json` independently confirms all
   three original requests remain pending, with zero reviews/notifications and the
   original counter of three.
2. Reopen and confirm Camille QA's approval. The loaded row becomes `Membre` and
   loses its decision buttons. Refuse Alex QA; its row becomes `Refusée`.
3. Sign out and in as the isolated administrator. Approve Jordan QA through the
   same scoped panel. Its loaded row becomes `Membre`.
4. Sign in as the parent: the access gate appears, without management controls.
   Sign out, then restore the manager for the narrow-layout check.
5. At 320x780, open and dismiss the separately seeded Robin QA request. The 288px
   dialog and buttons fit without horizontal overflow. No fourth decision is sent.

`persisted.json` is unchanged output from the read-only independent verifier:
Camille/Jordan active, Alex rejected, correct two manager/one administrator actors,
three immutable reviews, three correctly addressed notification records and club
counter five. Robin remains pending. The verifier never creates or reviews a
membership. Its source-base SHA and SHA-256 fingerprints record the tested working
tree before this task's commit; they are not a claim that the old base already
contained the implementation. The initial dismissal predates only the final
shorter confirmation heading. Final decision logic is unchanged and final source
fingerprints are retained in `persisted.json`.
After these captures, a display guard was added so a filtered, empty first page
with another club page does not claim there are no managed clubs. The ninth
controller case covers continuation; this does not add another manual UI claim.

## Reviewed Captures

- `manager-decisions.jpg`: directly captured 1080x550 region, showing the club
  manager's accepted/refused rows before the administrator's separate decision.
- `admin-decisions.jpg`: directly captured 974x410 membership section after the
  administrator decision; all three terminal outcomes are visible.
- `mobile-confirmation.jpg`: original 320x780 browser capture of the compact
  confirmation, which was dismissed without writing.
- `parent-denied.jpg`: retained access-gate evidence, not part of the public-facing
  partner gallery.

Only the first three reviewed images are allowlisted for the private progress
site. No pixels inside the app were edited. An initial administrator capture
framed the dashboard instead of the membership section; another returned a blank
frame. Both were rejected, remain only in temporary diagnostics, and are not used
as outcome evidence. The final capture uses the actual document-region coordinates.

## Rollout And Remaining Scope

These Functions, rules, management-site and Android changes have not been deployed
to production. Deploy them together before distributing matching clients. Queries
use existing single-field indexes; no new Terraform or paid infrastructure is
needed. The workflow now runs the 16-group service suite and controller checks;
Backend CI includes the new rules cases.

The manager role is already granted only by administrators; review never grants
global roles or manager membership. Historical malformed manager/request records
require explicit repair, not guessed privileges or statuses. Missing names remain
explicitly unavailable; child principals resolve from their child profile.

Child enrolment, team assignment, native membership results after refresh, club
switching, browser network/restart recovery and real push delivery still need
end-to-end evidence. Remaining trip/settings/payment, physical tracking and safety
requirements remain open. No final release-manifest acceptance is changed here.

## Subsequent Native Replay

[Run 38845283780](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38845283780)
at `215b690` passed the native unit job and general instrumentation, then stopped
in the isolated chat case before the first parent send. The timeout was the
keyboard-open wait after returning from landscape to portrait, not a send
acknowledgement. `chat-replay-failed.txt` retains the failure output with only
extra terminal blank lines removed; `chat-replay-original.txt.gz` retains the
unchanged original. The crash buffer was empty. This is not an accepted complete 15-case native run
and does not invalidate the independently verified web-management replay above.

The test previously issued an asynchronous hide request even if the keyboard was
already hidden, then immediately tapped the composer. That can conflict with its
show request; it is a suspected synchronization cause, not a proven app diagnosis.
The harness now hides only a visible keyboard, checks resource/display/window
orientation, and requires actual focus and keyboard visibility before replacing
text. Keyboard visibility, send acknowledgement and persisted-state assertions
are retained. Preflight failures now also produce a screenshot and a phase/window
diagnostic instead of missing the send-only diagnostic catch. A successful replay
is still required; this does not claim that general chat stability is solved.

[Run 38846769469](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38846769469)
at `2672f64` still fails the first parent keyboard-open check. The retained,
unchanged `chat-window-state.json` shows correct 1080x2400 portrait dimensions but
`windowFocused = false` and `keyboardVisible = false`. The composer-focus assertion
passed; no text replacement or send was attempted. Removing the redundant hide
and checking orientation did not resolve the failure.

The next replay requires actual window focus before tapping and captures the
native device frame, foreground package and focused-window identifiers on failure.
It does not activate another window, dismiss an unknown system prompt, force the
keyboard or remove assertions. This distinguishes a background/obstructed activity
from an app-input failure before choosing a production fix. The
[upstream focus change](https://android.googlesource.com/superprojects/androidx/+/15c5a887a08a2c2a53586d459c7e5e222b64d43d)
describes rejected input sessions before window focus; it is relevant context,
not proof that this is the same framework defect or grounds for an untested
dependency upgrade. No production app behavior is changed by these diagnostics.

[Run 38848431193](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38848431193)
at `8a0859e` passed all enabled jobs. `native-replay-passed.json` is unchanged
output from the complete isolated replay `0d579474baf6e0e076060a3c4b11bdfc`,
completed at `2026-10-16T04:11:42.483Z`: 15 instrumentation cases, with 16
coverage labels. The chat case opens the keyboard after rotation, exchanges four
new messages, verifies read acknowledgements and reaches all 120 history messages.
The directory, ride and reservation-decision cases also finish with independent
persisted-state checks. Search retains four explicit fake-gateway cases, and the
multi-seat SDK scenario is not a UI booking request. These scope limits remain in
the original JSON. No physical-device, live-payment or push requirement is accepted.

One successful replay after two failures does not prove that intermittent focus
loss is resolved or identify which native window previously obscured the app.
Repeatability, network recovery and real account transitions still need evidence.
The prior failed reports remain intact; no production input fix or dependency
upgrade was made merely to obtain a passing run.
