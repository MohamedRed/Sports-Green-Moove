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
the child's editor can be enabled. These decisions are not an implementation,
a production permission change or a successful native handoff.

Do not invent a number, substitute emergency services, or place a call
automatically. Contact details must remain private and must not be copied into
public team/club documents, logs or shared evidence.

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
