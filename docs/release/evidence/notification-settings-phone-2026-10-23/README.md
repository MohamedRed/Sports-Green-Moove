# Notification Permission, 23 October 2026

The old profile and Options hard-code notifications as enabled and send the
profile action to unrelated Options. The original failing static-label check and
the committed baseline sources are retained. A shared functional control now
reads the system app-wide notification permission, opens only that app's system
notification settings, and rereads on resume. Missing/denied settings activities
produce an explicit error, not an alternate launch or optimistic permission.

Seven JVM state cases and the full 504-case JVM suite pass. Seven additional
native component/platform cases compile, including narrow/large-text bounds,
resume transitions, current permission reading and exact intent scope. These
seven new native cases have **not yet executed** in the retained evidence.
The original full Node check while the owned backend was running has five
`EADDRINUSE` failures on port 5001. After the backend exits, all 1,764 cases pass;
both original transcripts are retained. No test, timeout or port guard is weakened.

A separate physical Google Pixel 9 Pro / Android 15 run uses the isolated local
APK and existing synthetic parent. The operator observes:

- Profile initially says blocked and opens the app-specific system settings.
- The system switch is initially off, then changed to on on this test phone only.
- Returning to Profile shows allowed; opening Options shows the same permission.
- Options opens the same system settings. Switching off and returning shows blocked.
- Returning to Profile also shows blocked. The original off value is restored.

Four independent read-only checkpoints retain all 158 original records and the
parent's claims, with only the profile's monotonic initialization timestamp allowed.
They prove record integrity, not the OS permission or notification receipt. Source
hashes bind the observer and app implementation to this trial. The APK is built
from the documented dirty source snapshot based on d3a2f553, not its unchanged APK.

Eight unscaled browser-stream rectangles are retained: six whole-phone crops at
254 x 559, and two Options-control crops at 230 x 132. Six reviewed images are
allowlisted for the public site. No image is a native screenshot export. The
recording tool again reports missing screen-sharing permission; no video is
accepted and Chrome/OS screen-sharing settings are not changed.

The parent signs out. App removal is explicitly confirmed, acknowledged by the
provider and checked through launcher absence. The session is explicitly stopped.
The observer, owned backend and scoped helper close; the credential/handoff files
are gone and all six owned ports are closed. No administration, update policy,
location setting or unrelated app is changed. Only the notification allow value,
not every internal permission flag, is measured/restored before uninstall.

No real notification, channel/DND behavior, provider delivery, process survival,
iOS, production data, payment or release readiness is accepted. Those remain
separate requirements. The public copy must not call this push-delivery proof.
