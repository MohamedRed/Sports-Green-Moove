# Android team draft recheck, 22 November 2026

The corrected fresh replay completed the physical Android draft scenario and
all six independent record checkpoints. Its records and 13 original JPEGs are
retained in `passed-replay/`. The interrupted first attempt remains unchanged in
`first-attempt/`. Each attempt used its own disposable backend and one explicit
parent Send action. This record does not close a production release requirement.

The BrowserStack Google Pixel 10 on Android 16 used the previously uploaded
17 November isolated `app-debug.apk`, package `be.sportgreenmoove.app.local` and
project `demo-sgm-local-qa`. Its recorded upload SHA-256 is
`29ae56b521ee11e6e3d47af7a58b4a15ce46d2580c4c954db8f76358c7c9f186`.
The four-service tunnel retained the approved loopback-only allowlist.

## Corrected replay

The fixed checker and the fresh controller remained at source commit
`b8f7db6d0bf645a0eca5747ddd07b081568a0149` throughout the successful replay.
The service run ID is `0b88240e51758342440e0b75274c05f6`.

The parent recovered the exact unsent draft after a provider Kill App action and
reopening the same installed app. One explicit Send produced one parent entry
and one matching operation. After a second Kill App action and reopen, the
message remained visible and the composer stayed empty.

A second, distinct private parent draft remained hidden from the driver account.
The driver's profile identity and team thread were reviewed on the same phone:
the parent message was visible, the driver's composer was empty, and the driver
could see the older fixture message that predates the parent's admission. After
returning to the original parent account, the private draft was restored and the
older message was still excluded from the parent's history.

| Independent checkpoint | Messages | Matching operations |
| --- | ---: | ---: |
| before | 2 | 2 |
| unsent | 2 | 2 |
| reopened | 2 | 2 |
| sent | 3 | 3 |
| cleared | 3 | 3 |
| other-account, after parent return | 3 | 3 |

Every checkpoint preserved the 158 protected records and account claims, allowing
only the expected parent/driver profile timestamp updates. The last independent
read followed the returned-parent capture; the driver's earlier UI observation
is retained separately in `other-account.jpg`. The controller did not submit
parent messages or mark messages read on the phone's behalf.

`results.json` binds the approved upload, source, device and service run.
`visual-review.json` records original capture save times and confirms no edits.
`sha256.json` covers every retained replay artifact. The exact controller source
versions are archived by digest in `../source-archive/`.

The first closure returned to Home; the second returned to the launcher's app
drawer. These observations support provider closure/reopening, without claiming
independent PID verification or a proven full-process restart.

BrowserStack reported `Succesfully uninstalled your app(s)!`, and the app icon
disappeared from the visible drawer. A complete package inventory was not checked.
The session then returned to the Uploaded Apps dashboard. The private credential
listeners, tunnel and backend stopped; the private session/runtime directories
were removed, all six temporary ports were verified closed, and the clipboard
was restored. The controller's own teardown flag remains false because later
environment disposal is independently documented in `cleanup.json`.

The phone observations and independent service checks are complementary evidence.
They do not prove two-phone delivery, unread counters, notifications, tracking,
production configuration, iOS behavior or overall release acceptance.

The combined focused verifier, authority, read-checkpoint, portal and child-account
checks pass 86 tests. The portal builds with its original 34 flows and five clips.
A separate headless Chrome 158.0.8127.36 process verifies the new demonstration
result and absence of horizontal overflow at 320, 390, 768 and 1440 pixels.
The 320- and 1440-pixel layouts were visually reviewed. Existing workflow paths
and commands cover the changed verifier, tests, evidence and portal modules;
no workflow, Terraform, native application or production configuration changed.

## Retained first attempt and checker correction

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
