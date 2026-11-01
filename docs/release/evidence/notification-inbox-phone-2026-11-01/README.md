# In-App Team Alerts, 1 November 2026

Two fresh Android 15 phone sessions use isolated local accounts and records.
Each completes nine independent persisted checkpoints: initial list, automatic
arrival, confirmed read, replay without duplication, revocation, renewed access
without old history, a later unread alert, pre-background state and return after
a background revocation. Driver sends and club decisions use authenticated SDK
peers, not another phone or management UI. The parent uses the actual app UI.

The first session exposes a separate privacy defect: the task switcher retains
an old notification-screen snapshot after the app is backgrounded. The live app
correctly hides the withdrawn alert when reopened, but that does not validate
its stale system preview. Its original image and complete records remain in
`first/`; they are not replaced by the successful recheck.

The corrected build disables task screenshots through the platform API before
displaying content on Android 13 and newer. See the [platform API reference](https://developer.android.com/reference/android/app/Activity#setRecentsScreenshotEnabled(boolean)). A second fresh phone session repeats
the complete nine-checkpoint flow. Its task-switcher card is blank while normal
foreground app captures still work. Returning shows only the protected ordinary
notification, not the withdrawn team alert. Both reviewed preview images have
separately measured, hash-bound samples; the uniform sample supports the observed
blank preview, not proof about every operating-system surface or version.

The foreground inbox uses its own authenticated, strictly parsed callable every
four seconds while its screen is active. A failed authoritative read hides the
rows and offers explicit retry. Backgrounding/disposal clears cached alerts and
ignores late replies. Notification polling does not reset review pagination or
query conversation history. Seven actual isolated callable scenarios and twelve
focused JVM cases pass. The local build's complete unit result is retained in its
build metadata. Four added simulated component cases compile, but are not accepted
as executed by these local build records.

All original top-level fixture records, account claims, disabled states and live
trips are protected except the parent profile's sign-in timestamp and the exactly
asserted guardian-verification transitions. Alert acknowledgement does not read
the team message. Each run ends with two driver messages, four private generic
alerts, two pending delivery envelopes and zero team-message read receipts.

The first session needs input corrections before sign-in. A temporary fixture
password appears in an unintended field during remote input; all eleven local
account passwords are regenerated before continuing. A later rejected sign-in
is not counted as successful. Native keyboard paste then succeeds. The second
session uses native paste correctly from the start. No reusable credential is
retained. Disposing the owned environments invalidates their temporary accounts.

Each provider reports successful test-app removal and returns to its idle
dashboard; package absence is not independently queried. Both owned helpers and
four-service runtimes stop, private session/handoff inputs disappear and ports
are independently verified closed. The second launcher also binds its removed
runtime directory. Original clipboard restoration is not proven; it is cleared.
No app-store/device-admin policy, browser permission, real account, production
resource, map request, payment or public audience is changed. No video is recorded.

Only four reviewed session crops from `verified/` are published. They are not
native exports. Local APK hashes and selected source snapshots are retained,
not independent installed-APK or whole-head attestations. The main flow remains
partial: closed/background-app push dispatch, token lifecycle, tap navigation,
simultaneous phones, older-platform preview policy and iOS are not accepted.
No release-manifest requirement is promoted by this result.

The capture log records the requested 198 x 443 crop. The capture command's
default chroma alignment actually produces 198 x 442 PNGs. These original outputs
are preserved without resizing or padding; the run separately records their
actual dimensions. Exact original full-frame alignment is not independently
attested by these crops.
