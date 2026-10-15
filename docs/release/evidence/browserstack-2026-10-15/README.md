# Android authentication validation - 15 October 2026

## Scope

Manual App Live run on Google Pixel 8 / Android 14, using `app-debug.apk` v0.1.0
(dashboard upload: 11 October, 20:20).
APK: `bs://b88a8b683dc92cb89be917cf4314bf0500df075f`.
Build source: `d21e0ea85936976848842912bd4d39b146ef01e0`, not the current
documentation-only head. The app uses production Firebase.

This run stayed signed out. No account, booking, message, support request,
payment, privileged role or production fixture was created or modified.
Only deliberately invalid forms were submitted. The example address is reserved
test data, not an account. An existing parent-only QA account was confirmed by
read-only inventory; a new successful login was not performed in this run.

## Observed Results

| Check | Result | Screenshot |
| --- | --- | --- |
| Login with empty email/password | Pass: email required | `01-login-empty-email.png` |
| Signup with all fields empty | Pass: name required | `02-signup-empty-name.png` |
| Signup with name and malformed email | Pass: valid email required | `03-signup-invalid-email.png` |
| Signup with valid-format email, password empty | Pass: password required | `04-signup-missing-password.png` |
| Signup with three-character password | Pass: eight characters required | `05-signup-short-password.png` |
| Rotate login to landscape, then swipe upward | Fail: login action remains clipped | `06-login-landscape-initial.png`, `07-login-landscape-after-swipe.png` |

After rotation the form values also cleared. Persistence requirements for
unfinished credentials were not assessed. This is not a theme-persistence or
authenticated-session restart test.

## Landscape Defect

Rotate the signed-out login screen from portrait to landscape. The hero occupies
most of the height, leaving the email field and only part of the next field
visible. A scroll attempt and upward touch drag do not reveal the login action.
Restoring portrait recovers access.

Source inspection supports the cause: `OnboardingScreen.kt` uses a non-scrollable
full-height column with an intrinsic-height hero and form. There is no vertical
scrolling or constrained-height adaptation. Fix this boundary, then retest both
forms with keyboard shown/hidden, landscape, small screens and large text.
**No fix is claimed in this evidence.**

## Evidence And Limits

Screenshots directly crop the device stream; app content is not retouched. They
contain no real identity or account credentials. Recording could not start in the
background; no new video is claimed. The device session was stopped after
restoring portrait. Chrome was not restarted.

These are five form-validation checks, not five completed end-to-end journeys.
Earlier login/sign-out results remain in `../browserstack-2026-10-11/README.md`
and `../browserstack-2026-10-13/README.md`.

Multi-person publication, booking, clubs, messaging, payments and ride lifecycle
tests remain blocked on the isolated setup. Staging billing access is unresolved.
Local emulator testing has been explained but is not yet authorized. No physical
tracking or safety-audit manifest item is accepted by this run. The release gap
report remains authoritative.
