# Whole-Trip Cancellation On One Physical Android Phone

28 October 2026, source baseline `ce93e568b7f636c0d6ce39f91daec4c4b80d72e7`.
Fresh local-only APK build, one Google Pixel 9 Pro / Android 15, private scoped
connection to disposable services. No production writes, map requests or payment.
The source APK hash is not independent verification of installed bytes.

## Observed Result

The driver opens, dismisses and reopens the cancellation preview without business
writes. The preview lists two affected reservations and requires a reason. One
explicit confirmation cancels the accepted child booking (two seats) and another
parent's pending one-seat request. Only the accepted two seats are restored:
capacity returns from two to four. One immutable receipt and one scoped in-app
notice per parent are created. The earlier already-cancelled adult reservation,
unrelated documents, claims and live-trip data remain unchanged.

The cancelled trip moves to past trips without a cancellation action. Provider
Kill App(s), followed by independent package-scoped measurements, records PID
20860, no process, then PID 29199 after launcher reopening. The authenticated
driver still finds the same cancelled trip. This is measured process termination,
not a manually confirmed Android App info Force stop sequence.

The first parent finds the child's two cancelled seats plus the older closed
adult booking and the cancellation notice. The second parent sees only its own
one-seat cancelled request and its own notice. Opening notifications does not
mark either notice read. Three accounts sign out; the final blank login form,
uninstall acknowledgement, independent package absence and idle dashboard are
reviewed. Twelve independent full-record checkpoints pass. Reader clients close,
both supervised launchers stop after SIGINT (130), owned PIDs disappear, six
ports can be bound and private runtime/session/helper paths are absent.

## Evidence Boundaries

The original observed snapshots precede assertions and are retained unchanged.
The separate UI review is manual, not proof supplied by those stored snapshots.
The fixture creates/approves bookings through authenticated services, not phone
UI. No synthetic paid metadata is added. No refund or push delivery is proven.
This is not the simultaneous cancellation/approval race, a two-phone test, iOS,
physical GPS validation or overall release clearance. The existing native socket
tracking blocker remains unchanged. Operator keyboard/clipboard issues and the
unsupported initial process command are recorded in the separate UI review.

The user approved session-window captures for the existing public progress site.
Seven reviewed synthetic-only images are published as session captures, not
native exports or a video. Earlier dated galleries and public audience remain.
Every artifact is checksummed; relevant source bytes are retained by hash.
No infrastructure or Terraform configuration changes are required.

Validation: `node --test tests/trip-cancellation-phone-checkpoints.test.mjs tests/trip-cancellation-phone-evidence.test.mjs`.

## Publication Verification

The first full Node pass has four stale gallery/tour/workload-expectation failures,
not phone business-record failures. The corrected full pass is 2481/2481. Earlier
focused checks also caught an incorrect PNG assumption: the session screenshot
API returns JPEG bytes. Originals retain the same bytes with correct `.jpg`
names, decoded dimensions and checksums; no conversion or replacement is claimed.
Full browser checks pass at 1440, 768, 390 and 320 pixels, including the five-step
cancellation tour, older galleries, short videos, deep links and overflow/assets.
The terminal baseline PR snapshot has 22 successes and five intentional skips.
It predates the new evidence commit and does not verify that later commit's CI.
