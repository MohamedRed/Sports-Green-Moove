# Notification Read: Physical Android, 23 October 2026

One fresh disposable physical Google Pixel 9 Pro / Android 15 used the local-only
APK from application commit `87082b10`, connected privately to `demo-sgm-local-qa`.
The independent controller was uncommitted during this trial; its exact source
and SHA-256 are retained. It does not control the phone or acknowledge a notice.

The operator observed and captured the actual app:

1. Parent opens three unread approval notices.
2. Parent marks only "Lecture choisie QA" read. Its action disappears and the
   unread badge changes from three to two; the other notices remain unread.
3. Parent signs out. Driver signs in and sees its own unread cancellation notice,
   with none of the parent's approval notices.
4. Driver signs out. Parent signs back in and opens the inbox. The selected notice
   is still read, the other two remain unread and no driver notice appears.

Four independent snapshots bind those observations to 167 protected records,
claims and live-trip state. Only the selected notice's read/readAt fields change;
the first server timestamp survives account switches. Fresh authenticated inbox
reads and foreign-write denials are separate service probes, not phone actions.
The serialized snapshots and exact controller sources validate without a server.

Four reviewed JPG images are original browser-stream rectangles, 254 x 559,
without edits to app content or resizing. The capture API returned JPEG bytes
despite the initial private .png filename; only the extension was corrected.
No login, credentials, provider UI or diagnostic capture is published. There is
no accepted video. Remote focus/symbol-forwarding preparation is excluded.

The provider's Kill App(s) request displayed a force-kill-in-progress banner but
did not establish a completed stop/relaunch or changed PID. The `reopened`
snapshot means parent account return only. Full physical process death remains
unproven. No push dispatch, production tracking, maps, payments, iOS or release
acceptance is inferred. The separate native CI restart trial has its own outcome.

The operator explicitly stopped the phone session and observed the device
selection dashboard. Final sign-out/uninstall/launcher absence are unverified;
the attempt does not pretend otherwise. The observer closed, both owned local
supervisors exited 130, the private session/helper directory were removed, and
all six owned endpoints refused connections. No personal device, browser restart,
global phone setting or administration policy was changed.

The public progress site may publish only `captures/*.jpg` from this bundle.
All raw records, source snapshots, identities and cleanup receipts remain
repository evidence, not downloadable portal media.
