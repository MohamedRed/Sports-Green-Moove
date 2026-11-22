# Android team draft recheck, 22 November 2026

The first attempt is retained in `first-attempt/`. A corrected, fresh isolated
replay is pending. This record does not close a production release requirement.

The BrowserStack Google Pixel 10 on Android 16 used the previously uploaded
17 November isolated `app-debug.apk`, package `be.sportgreenmoove.app.local` and
project `demo-sgm-local-qa`. Its recorded upload SHA-256 is
`29ae56b521ee11e6e3d47af7a58b4a15ce46d2580c4c954db8f76358c7c9f186`.
The four-service tunnel retained the approved loopback-only allowlist.

Original browser-context JPEGs show the initial team message, exact unsent draft,
the phone Home screen after the provider's Kill App action, the restored draft,
and the sent message with an empty composer. One parent Send action was used.
The independent controller accepted `before`, `unsent` and `reopened`, including
the original 158 protected records and unchanged account claims.

The `sent` checkpoint failed in the checker. It compared complete message rows
between viewers, including `needsRead`. The parent's own new message correctly
had `needsRead: false`, while the driver's incoming view had `needsRead: true`.
The checker had already compared the expected authors, bodies and sequences;
its subsequent operation-count and protected-baseline checks did not execute.
Do not promote this incomplete report into a complete service verification.

The correction compares all shared message fields while checking each viewer's
read-flag type and rejecting an incoming-read flag on their own message.
Realistic regression fixtures reproduce the old rejection. The three focused
manual-view/read/authority test files pass 42 checks after the correction.
Web Integration Smoke already includes the affected test command and paths.

The controller closed its admin client. The phone session, tunnel and owned
backend were stopped, both private runtime directories were removed, all six
temporary service/input ports were verified closed, and the clipboard was restored.
`first-attempt/sha256.json` covers retained originals and sanitized records.
The four original controller source versions are retained in `../source-archive/`.

Full-process identity, notifications, production tracking, two-phone delivery,
iOS device behavior and release acceptance remain unverified by this attempt.
