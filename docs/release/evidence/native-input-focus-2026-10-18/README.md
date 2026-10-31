# Native Input Focus Failure

Run: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39134039367

Source: `15b6542fd4fb17d7682083ea76abcc2ceecb50c1`; artifact
`android-connected-ui-test-results`, ID `12138849625`.

`general-ui.xml` is the original artifact XML, unmodified:
SHA-256 `6c83bbc35e23ee39cb8c268dfba892ac604cf2ae5170af521d55d222425daedc`.
It records 124 cases: 87 passed, six failed, 31 intentionally skipped and zero
errors. All six failures timed out in `InputWindowReadiness.awaitFocus`.
Both standalone activity/dialog probes failed, alongside cancellation,
two trip-change cases and unfinished-draft restoration.

The app root was attached, resumed, shown, unlocked and interactive, but did not
receive window focus. Device logcat also repeatedly reported Settings
`FallbackHome` waiting for an enabled home application while the test setup had
disabled the launcher. This is a diagnostic lead, not proof of the focus owner
or an attribution to a service update. The OS focus owner was not captured in
this run. No longer deadline, synthetic click, forced foregrounding, replacement
keyboard or automatic rerun is justified by these observations.

All three `PaymentConfirmationLayoutTest` cases passed within the failed suite.
No new payment screenshots were retained: the collector only pulled that
directory after a completely successful ordinary suite. The passing assertions
are component evidence, not a reviewed rendering, a live checkout or an accepted
release requirement. `native-suite-status.json` preserves the failed ordinary
suite and separately successful collection/replay exit statuses; it does not
by itself prove every local replay assertion.

The follow-up diagnostic reads a bounded window-manager snapshot only after an
input failure. It logs allowlisted package identities, never window titles,
editor contents or raw dumps. It preserves the original failure and deadlines.
Partial component captures are now collected in a separately named directory
even when an unrelated test fails; they still require case-result and visual
review before publication. These changes are not a root-cause fix or a passing
device replay. Real-device tracking, emergency handoff, payment-provider and
safety-audit evidence remain outstanding.

## Next Already-Running Attempt

Run `39135422165`, source `fc15e9b14a27a4bd84ab1eba6c0b80923d455754`,
finished with failure. Android sources were identical to the first run; this
was the existing PR run, not a retry to erase the first failure.
`next-general-ui.xml` is the original XML, SHA-256
`5e5e14b581ecd3441f6c72af99ee0b52f5da147c07e59651b808f6d07524097f`.
It contains 117 completed/reported cases: 85 passed, one empty failure and
31 skipped. The runner separately reported “Process crashed” during
`parentOpensFromAffectedReservationAndKeepsTheRecordedRefusalVisible`.
The empty XML failure does not identify a Java exception or establish an app
root cause. Both input probes and all three payment layout cases passed this
time; the remaining cases were not all reached. Payment captures are still
absent because collection was conditional on an overall pass.

`next-native-suite-status.json` retains ordinary failure and local replay
failure. Local replay stopped at the first file-sync failure after the
trip-consent-recovery device assertion passed. The independent cleanup copy
succeeded, but cannot substitute for the failed primary copy or the missing
full-run result. Store restoration reported restored=true, verified=false;
the runner reported that the Maps runtime changed. Neither event establishes
the cause of the earlier process stop.

Follow-up collection now captures the ordinary app package's OS exit reason,
bounded crash/system/package logs and installation state immediately after a
failed ordinary suite, before the independent replay. Existing isolated-replay
collection retains its separate package. This is read-only diagnostic evidence,
not a restart, retry, relaxed assertion or root-cause fix.

## Follow-Up Local Validation

The diagnostic implementation passed Android JVM tests (including three
sanitizer cases) and `assembleDebugAndroidTest`. All 459 root Node checks passed.
The updated private portal passed browser checks at 320, 390, 768 and 1440 pixels;
desktop/mobile overview and remaining-work views were visually reviewed.
These checks do not execute the new failure diagnostic on a device or resolve
either failed native run. A new CI run is still required for that evidence.

Android's home-recovery loop is documented in the
[Android 15 source](https://raw.githubusercontent.com/aosp-mirror/platform_packages_apps_settings/android15-release/src/com/android/settings/FallbackHome.java).
This explains the observed message but does not identify the failed window's
owner. The read-only diagnostic uses the documented
[`dumpsys` timeout](https://developer.android.com/tools/dumpsys).
