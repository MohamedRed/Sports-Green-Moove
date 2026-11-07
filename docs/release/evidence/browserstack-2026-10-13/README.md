# BrowserStack Android Flow Recordings

Recorded on 2026-10-13. These are new replays of previously tested flows, not recordings
of the original 2026-10-11 sessions and not an overall release approval.

## Environment

- BrowserStack App Live: Google Pixel 8, Android 14.
- APK source: `d21e0ea85936976848842912bd4d39b146ef01e0`.
- Uploaded app: `bs://b88a8b683dc92cb89be917cf4314bf0500df075f`.
- Recording session: `5e1a5d5a49ac55704ede76784836a7f6fb1939a4`.
- Firebase project: `sports-green-moove-prod`.
- An existing, enabled, parent-only native test account was reused. No new account,
  privileged role, club, child, booking, payment, or ride fixture was created.
- Credential entry was performed with recording stopped. Account identifiers and
  credentials are omitted from this report and the exported recordings.

## Clips

1. [Parent Navigation](parent-navigation.mp4): authenticated Home; upcoming, past, and
   pending Trips tabs; driver-required publication restriction; Chats, Notifications,
   and Reviews navigation. The Chats screen displays an inbox synchronization state;
   this recording does not establish chat delivery or a successful conversation.
2. [Sign-Out And Relaunch](signout-relaunch.mp4): Profile sign-out returns to login;
   a subsequent force-stop and launcher relaunch remains signed out. The Profile
   identity section was scrolled off-screen before recording began.

The November 2022 dates and empty calendar handlers reported on 2026-10-11 remain
unresolved. Empty screens do not establish booking, payment, or multi-user behavior.

## Export Details

- Original BrowserStack downloads are retained locally in the user's Downloads folder
  with `SGM-parent-navigation-original-2026-10-13.mp4` and
  `SGM-signout-relaunch-original-2026-10-13.mp4` filenames.
- BrowserStack's files contain VP8/Opus streams despite their `.mp4` extensions.
  The committed exports are H.264, have no audio, and are cropped to the device.
- Parent Navigation preserves the full recording duration.
- Sign-Out And Relaunch retains original intervals `[0, 55)` and `[200, end)` seconds,
  omitting idle/Inspector troubleshooting between the two checks. It is an edited
  recording, not a continuous cold-restart trace. No ADB shell commands were executed.
- Both exports were decoded and visually reviewed before delivery. BrowserStack's
  device session was ended after downloads completed. Chrome was not restarted.

No application, infrastructure, or workflow behavior changed. No new
`web-integration-smoke.yml` scenario is needed for video evidence alone. This evidence
does not accept active-ride restart, tracking, or safety-audit release requirements.
