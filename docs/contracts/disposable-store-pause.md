# Disposable Test-Phone Store Pause

The owner authorized pausing app-store updates only on the disposable test phone
on 18 October 2026. `SGM_PAUSE_TEST_PHONE_STORE=true` opts in in Native CI.
The shared connector still requires the disposable-emulator flag, exactly one
available emulator and its qemu identity; every command targets that serial.
The pause additionally requires the approved Android 15 image, enabled store and
Play services, a supported Maps runtime, enabled location and a readable installer
state without an active store installation. No active installation is cancelled.

The implementation force-stops only `com.android.vending` for user 0, verifies
its stopped state and rechecks Maps/location. It neither disables the store nor
changes Play services, maps, location, networking, verification/security settings,
app data or any personal phone/browser. Android 15's stopped-state behavior is
documented by [Android Developers](https://developer.android.com/about/versions/15/behavior-changes-all#enhanced-stop-states).
This is a scoped background-store pause, not a guarantee against every other
system update mechanism or crash.

Setup writes a sanitized receipt. After both independent suites and evidence
collection, an EXIT cleanup verifies that the store stayed stopped, restores the
original stopped state on the same emulator using the Android 15
[`pm unstop` command](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android15-release/services/core/java/com/android/server/pm/PackageManagerShellCommand.java),
and rechecks the unchanged Maps version and enabled location. An already-stopped
store remains stopped. A failed pause rolls back its own mutation; cleanup errors
fail an otherwise green suite without overwriting an earlier suite failure.
Hard runner termination destroys this CI emulator; no persistent personal device
has its state changed. Home-screen/store navigation remains outside this suite.

Eight mock-device tests and nine native-suite-shell tests check these contracts.
These are configuration/cleanup tests, not proof that a new device replay has run
or that the previous package-update interruption can no longer occur. The first
actual paused-store execution remains pending.

The first native attempt (39084958578, source `0f5603c`) stopped at preflight,
before either app suite, because the diagnostic matched two `User 0:` lines.
AOSP emits bare user headings for permission/changed-package sections in addition
to the actual package-state row. Parsing now excludes only those bare headings,
still requires exactly one concrete installed/stopped row, and rejects duplicate
concrete states. A new regression covers both forms; no state check was bypassed.
