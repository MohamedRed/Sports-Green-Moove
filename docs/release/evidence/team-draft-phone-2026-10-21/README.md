# Physical Team Draft And Account Switch, 21 October 2026

An actual App Live Pixel 8 / Android 14 session used the existing subscription,
the pinned isolated APK and the owned `demo-sgm-local-qa` loopback environment.
No production data, live maps, payment or plan change was involved. App source
and build-script Git objects are unchanged from the pinned `70daee2` build;
the manual record controller ran from `78d6df3`.

Eight original 1080 by 2400 device PNG exports were saved, visually reviewed
and published without editing their contents:

1. The verified parent sees only the post-admission team message.
2. The parent types an accented draft without sending.
3. After the provider's Kill Apps action, observed home screen and reopening
   from Android recents, the original text returns without retyping.
4. One explicit native send produces one parent message; the composer clears.
5. A second Kill Apps / home / reopen sequence leaves that composer empty.
6. A second, different parent-only draft is entered without sending.
7. The separate driver signs in on the same phone, reads the sent message,
   sees its own earlier history and has an empty composer, not the private draft.
8. Returning to the original parent restores that second private draft.

Six independently collected record checkpoints confirm two seeded messages and
operations before send, exactly three after send, one parent operation, and 158
protected records and actor claims preserved except allowed profile timestamps.
The final `other-account` record read was intentionally taken after returning
to the parent, so it also excludes automatic submission of the second draft.
Its name identifies the ordered controller checkpoint, not the current phone
identity; every controller report explicitly disclaims phone-UI proof.

The provider reported force-killing app processes, and both home screens were
observed. Process IDs were not independently read; this is not the prior local
three-distinct-process proof and does not accept release tracking restart tests.
The two context JPEGs retain observed stop states, not native pixel exports.
Recording failed at OS screen-sharing permission; no new video exists and the
browser was not restarted. Device policy and installation permissions were not
changed. The provider reported successful app uninstall, the phone returned to
the upload dashboard, and independent local cleanup confirmed no owned helper
or backend processes, all four ports refused, and both private handoffs removed.
Package inventory and provider factory-reset state were not independently read.

This is one physical phone with sequential parent/driver accounts and separate
authenticated service reads, not simultaneous phone-to-phone delivery. Unread
state, push, authority changes on physical phones, GPS/background tracking,
other platforms, production and release-audit requirements remain open.
