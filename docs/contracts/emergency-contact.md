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

The owner has been asked whether the target is a user-saved contact or emergency
services. Do not choose a destination, invent a contact, or silently substitute
one for the other while that decision is pending. No production profile or
notification policy is changed by this audit.

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
- If the owner chooses a personal contact, test validation, save/reload, failed
  save, interrupted reply, concurrent edits, removal and account switching. No
  other account may read, edit, retain or dial the previous user's contact.
- Verify the active-ride entry point for parent and driver, navigation back to
  the ride, large text and narrow layout. Do not reuse pickup/dropoff or tracking
  screenshots as proof of emergency-contact behavior.

Only verified actionable evidence can restore the manifest item's accepted
state. Physical tracking and the six safety-audit event requirements remain
separate and unchanged.
