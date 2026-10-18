# Disposable Test-Phone Store Pause

The owner authorized pausing app-store updates only on the disposable test phone
on 18 October 2026. `SGM_PAUSE_TEST_PHONE_STORE=true` opts in in Native CI.
The shared connector still requires the disposable-emulator flag, exactly one
available emulator and its qemu identity; every command targets that serial.
The ordinary app and instrumentation are compiled before any device mutation or
runtime baseline is recorded. A failed build exits with its original status and
a separate `native-build-status.json`; neither suite nor store setup runs.
This avoids measuring the cold-build interval as though app testing had started.
It does not assert that startup updates have finished or relax the unchanged
version requirement from device setup through both app suites and cleanup.
The pause additionally requires the approved Android 15 image, enabled store and
Play services, a supported Maps runtime, enabled location and a readable installer
state without an active store installation. No active installation is cancelled.

The store alone receives Android's documented background restrictions:
`RUN_IN_BACKGROUND=ignore` and `RUN_ANY_IN_BACKGROUND=deny`, followed by one
force-stop. [Android Developers](https://developer.android.com/topic/performance/background-optimization)
documents those controls for background services/broadcasts and restricted jobs.
Both original operation modes are read first; unknown output or a UID-wide
override stops setup rather than guessing or changing other packages' policy.
The store remains enabled. No Play services, maps, location, networking,
verification/security settings, app data, personal phone or browser is changed.
Store/home-screen interactions are excluded; this is not a guarantee against
other system update mechanisms, crashes or foreground store activity.

Setup writes a sanitized receipt. After both independent suites and evidence
collection, EXIT cleanup verifies both background restrictions still hold,
no store install is active, Maps remains enabled at its original version and
location remains enabled. It restores both original background modes and the
original stopped state on the same emulator using Android 15's
[`pm unstop` command](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android15-release/services/core/java/com/android/server/pm/PackageManagerShellCommand.java),
without requiring its process to have remained stopped: waking a service must
not lift the independently enforced background restriction. An originally stopped
store is stopped again on cleanup. A failed pause rolls back its own mutation; cleanup errors
fail an otherwise green suite without overwriting an earlier suite failure.
Typed cleanup observations are retained even when verification fails.
Hard runner termination destroys this CI emulator; no persistent personal device
has its state changed. Home-screen/store navigation remains outside this suite.

Focused mock-device and native-suite-shell tests check these contracts.
These are configuration/cleanup tests, not proof that a new device replay has run
or that the previous package-update interruption can no longer occur. Actual
execution of the background-restriction implementation is recorded below.

The first native attempt (39084958578, source `0f5603c`) stopped at preflight,
before either app suite, because the diagnostic matched two `User 0:` lines.
AOSP emits bare user headings for permission/changed-package sections in addition
to the actual package-state row. Parsing now excludes only those bare headings,
still requires exactly one concrete installed/stopped row, and rejects duplicate
concrete states. A new regression covers both forms; no state check was bypassed.

Run 39085238967 (`155bbaf`) applied the earlier force-stop-only method, but the
store's stopped flag was cleared at cleanup. This neither identifies what cleared
it nor proves an update occurred. The method did not establish a sustained
background pause; the job remains failed. Its 32 local groups and three draft
component cases passed, while one separate large-text component capture failed
in PixelCopy. Run 39085527859 (`57512fa`) passed ordinary/component tests but
failed the local network-preparation probe before an offline send. These are
separate failures; neither establishes their shared cause. The new policy
replaces the force-stop-only implementation, rather than retrying or silently
accepting resumed background execution.

Run 39087981053 (`608bc41`) completed all 33 local groups and ordinary/components,
but its final runtime check failed: Play services changed from `24.23.35` to
`26.40.32`. Both restricted store modes remained in place and original modes were
restored. The [retained receipts](../release/evidence/local-replay-33-2026-10-18/README.md)
do not identify when or how the update occurred, and do not establish that the
pause prevented updates. The subsequent `c3ac913` replay also completed 33 groups
and retained typed carrier-loader observations, but failed the same version
invariant. Moving compilation before setup has not yet executed on a device;
it is not accepted as an update-prevention repair without a fresh complete run.
