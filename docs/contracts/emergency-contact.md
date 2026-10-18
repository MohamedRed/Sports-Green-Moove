# Emergency Contact

## Current Audit

Source audit on 2026-10-17 at `e1177c13d8cd016a691ffb0307e110af038177af`:

- Android `RideMonitorScreen.kt` renders `RideEmergencyCard` as a static row.
  It takes no action callback, has no clickable control or dialer intent, and
  says a direct action is available. Its test tag proves presence only.
- Android `OptionsScreen.kt` displays the fixed number `+32 470 00 00 00`.
  It neither reads a saved emergency contact nor saves one. It is not an
  authorized contact or an emergency-services number.
- `StoreReviewScreenshotTest.kt` asserts that the tagged row is displayed and
  captures it. It does not assert a click action or perform a contact handoff.
- The historical screenshot and its original artifact remain retained. A
  non-empty 1080x2400 image does not establish a working emergency action.

`emergency_contact_action_screenshot` is therefore pending in the release
manifest. This corrects an overbroad acceptance; it is not a runtime fix or a
claim that a new call/device test was executed. No existing raw evidence is
deleted, rewritten or relabeled as a successful call.

## Product Decision

On 2026-10-18 the owner selected a saved personal emergency contact. Adults
manage their own contact; a child's verified parent chooses the child's contact.
The club manager verifies parent-child authorisation, separately from approving
team enrollment. A manager's verification role does not give them permission to
choose or edit that child's emergency contact.

The current `guardianUserIds` link is not evidence of manager verification:
clients can declare that link when creating a child record. Do not reuse it as
verified-parent authority for this new flow. Verification needs server-owned
records, current scoped manager authority, revocation and denial tests before
the child's editor can be enabled. `guardian-verification.md` now records the
isolated service checks for that authority; native review and contact integration
are still missing. These decisions are not a complete implementation,
a production permission change or a successful native handoff.

Do not invent a number, substitute emergency services, or place a call
automatically. Contact details must remain private and must not be copied into
public team/club documents, logs or shared evidence.

## Private Service Implementation

On 2026-10-18, `getEmergencyContact` and `saveEmergencyContact` were added to
source and verified through 16 isolated HTTP scenario groups. Original proof:
`docs/release/evidence/local-emergency-contact-2026-10-18/README.md`.
These endpoints are not deployed. Android editor source is now wired; its initial
execution still pending at that point is now superseded by the scoped replay below.

An adult-role account manages only its authenticated identity. Child-role
accounts cannot manage contacts, including mixed child/parent claims. A child
contact is keyed to the child, not copied per parent or club. A parent supplies
the child and verification-club IDs; the server checks their exact current
verified tuple, declared relationship, active membership and nonarchived club
inside every read/write transaction. A club manager cannot use their management
role to read or edit it. A parent verified through another club must independently
meet those same current checks; a client-supplied verified flag grants nothing.

Contacts and operation receipts are server-only collections. Direct client reads,
queries and writes are denied even for admin claims. Inputs require an explicit
international number and bounded nonempty name; no country or number is guessed.
Concurrent edits compare revisions. Removal retains a versioned null contact,
preventing a stale first save from restoring a removed number. Operation IDs are
actor-bound and payload-bound; replay never restores the old value and rechecks
authority before returning the current revision. Operation receipts store no
contact name or number. Revocation and relationship/membership changes participate
in the same transaction conflict fence as contact writes.

The service tests do not establish the app editor, process interruption recovery,
account-switch privacy in the app, child/driver ride access or a dialer handoff.
No call is placed, no contact permissions are added to public club/team records,
and the store-review emergency action remains pending.

## Android Editor Source

The Android editor and its settings/active-ride entry points now compile. Original
evidence `local-emergency-editor-2026-10-18` records 23 executed unit cases and six
compiled-only component cases. No native screen execution or phone handoff is
accepted from that build evidence. The former fixed settings number and inactive
ride row are replaced, not retained as successful fallback behavior.

Adult edits are auth-bound; the parent chooses a child from paged verified history,
then the adapter re-reads its exact current identity and the contact server enforces
current authority. Missing names are not invented. Unsaved navigation/removal asks
for confirmation. A failed or unknown save clears actionable contact data until
an explicit fresh read. Backgrounding/account disposal clears contact values;
restoration stores only owner-scoped target IDs, not contact names or numbers.

A phone tap re-reads the server and compares the saved revision and destination.
A changed destination requires another tap. The only platform handoff is
`ACTION_DIAL`; no direct-call permission, automatic call or substituted number is
added. Missing dialer/security failures keep the authorized contact visible with
an accurate failure, not a connected-call claim.

This editor is not the child's own dial path: child-role accounts cannot edit,
and their separate read-only active-ride access remains to implement. It must use
authenticated child-device identity and currently valid authority of the parent
who saved the contact. Current service records do not yet retain that verification
club as read-only child-access provenance. Connected native end-to-end replay,
actual dialer verification, landscape checks and the store-review action remain
pending; no existing manifest item is accepted by source compilation.

## Executed Android Components

The completed run at `53508fbe5e0925097a66e5f36b1b5925e835c423` executed all six
contact component cases. `local-replay-34-2026-10-18` retains the original passing
suite and four reviewed captures, including narrow layout and large text. The
contact gateway and dialer results are explicit in-memory fixtures; this does not
prove SDK-connected storage or an actual phone handoff. The same whole run passed
34 local application groups / 36 native cases, with the original network readiness
checks and successful device-policy restoration.

`LocalEmergencyContactFlowTest` adds a separate isolated connected replay:
adult save, activity recreation, verified-parent child save, manager revocation,
actual `ACTION_DIAL` destination/window, return, removal and account isolation.
The verified fixture relationship is preseeded; only revocation is performed by
the manager SDK in this stage. The stage requires its same-run primary copy,
original screenshots, passing transcript, independent contact/operation checks
and successful scoped cleanup before it can write a success report. It expands
the next full runner to 35 groups / 37 native cases, but execution is still
pending. It is not physical-device, full process-death or child-own-account proof.

## First Connected Replay Attempt

Run `39155710166` at `f3da854499b422b82ce726be504aaef4915c71a4` reached
adult save/reload, activity recreation, the preverified child's contact and
revocation. Four reviewed pre-failure observations are retained in
`local-contact-dialer-failure-2026-10-18`. The stage then failed waiting for the
resolved phone package. There is no passing contact marker, independent final
operation verification, removal/account-isolation pass or completed 35-group run.
The child's own account path remains unimplemented.

The next attempt records the resolved component, visible package, nonblocking
intent-monitor counts, allowlisted app feedback and a window capture before the
same 60-second assertion. This diagnostic does not substitute a phone app,
launch from the shell, place a call, weaken an assertion or grant permissions.
If diagnostics fail too, the missing-phone assertion still remains a failure.

The later diagnostic run `39157444338` did not reach that attempt: a system
module update killed the ordinary trip-change test process, then the emulator
went offline. Its empty restoration output is not accepted as a success receipt.
Separately, three executed unit regressions reproduce the contact state's queued
callback behavior. The native phone wait now polls through Compose's scheduler
with the same package predicate and 60,000 ms deadline; original timeout failures
are preserved if diagnostics also fail. Three native synchronization regressions
compile but have not run. `local-contact-scheduler-2026-10-18` retains that exact
scope and the separate interruption evidence. Actual handoff was unverified at
that snapshot; the later result follows.

## Connected Replay Passed

Run `39159125951` at `6cc965f7b2df816ba004ec7e65e0285cd15efd0d`
passed all nine contact checks using the local SDK, including the actual phone
dialer window and return, without placing a call. Original evidence and seven
reviewed result screenshots are retained in
`local-contact-dialer-pass-2026-10-18`. The preverified parent fixture and actual
manager revocation, three independently checked operations, scoped cleanup and
primary transfer receipt are explicit. Three native synchronization regressions
also actually passed in that run's ordinary suite.

The full replay failed later copying another stage's evidence. This does not
accept the entire 35-group run. The passed contact stage enters through settings,
not an active ride; the child's own read-only account path, full process death,
physical device and store-review action remain pending. No production deployment
or release-manifest acceptance follows from this scoped pass.

## Required Verification

- The agreed destination must be displayed accurately and backed by the relevant
  authoritative configuration. A failed read must not look like an empty contact
  or a working action. A missing contact must not receive an invented number.
- An actual enabled native control must open the phone dialer only after the
  user's tap. The app must not place a call automatically, add a direct-call
  permission or report that a call connected merely because it opened a dialer.
- Verify the destination and handoff in the app without placing a call. Retain
  the action screen and dialer result, with private contact data sanitized for
  sharing. A mocked callback or intent assertion is only component evidence.
- A device without a compatible dialer must show an accurate failure and retain
  the visible contact, not substitute another number or claim success.
- For the personal contact, test validation, save/reload, failed
  save, interrupted reply, concurrent edits, removal and account switching. No
  other account may read, edit, retain or dial the previous user's contact.
- For a child, deny edits by an unverified, refused or revoked parent and by the
  manager who verified the relationship. Verify that current parent authority is
  checked on the server, including concurrent revocation and account changes.
- Verify the active-ride entry point for parent and driver, navigation back to
  the ride, large text and narrow layout. Do not reuse pickup/dropoff or tracking
  screenshots as proof of emergency-contact behavior.

Only verified actionable evidence can restore the manifest item's accepted
state. Physical tracking and the six safety-audit event requirements remain
separate and unchanged.
