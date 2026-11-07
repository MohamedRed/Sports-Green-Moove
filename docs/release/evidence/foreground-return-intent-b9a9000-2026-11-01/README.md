# Foreground Return Intent Identity

At b9a9000, the focused remote ride-stop trial again reaches its final empty-ride
capture but fails in ActivityScenario.close at STARTED. Explicitly finishing the
owned Activity and waiting for the real DESTROYED stage did not repair the
scenario's cached state. Preserve that failed candidate, its original transcript,
background checkpoint, independently verified restoration and archive digest.
The complete native workflow is not accepted from any focused success.

Source inspection identifies a specific identity mismatch. The return used a new
component-only Intent, losing the initial launcher action/categories. MainActivity
legitimately stores a new incoming Intent in onNewIntent. The installed
androidx.test:core:1.6.1 observer filters lifecycle callbacks against the original
Intent, including action/data/type/package/component/categories/identifier. It can
therefore ignore the subsequent resumed/destroyed callbacks while the real Activity
has already moved on. The installed AAR/classes digests and disassembled matching
method/observer are retained. This is a source-supported cause, not a new isolated
runtime reproduction or a successful corrected replay.

The candidate returns with a copy of the actual launch Intent, retaining its
filters while replacing launch flags with REORDER_TO_FRONT only. This also avoids
replaying NEW_TASK/CLEAR_TASK/CLEAR_TOP. The failed manual-finish candidate is
removed; normal scenario disposal remains mandatory. The completed return must
now satisfy both the real RESUMED stage and the scenario's RESUMED state, and must
retain matching filters, before its final capture. No production Intent handling,
permission, assertion threshold, timeout or provider behavior changes.

Two Android framework regression cases compile for launcher and deep-link filters,
copy isolation, flags, extras and API-appropriate identifiers. Compilation is not
execution. The connected ride-stop replay and whole native gate still need to
pass. No screenshot/video is added to the public Site, and no historical phone
date, tour, partial status or release requirement is promoted.

Primary implementation reference:
[ActivityScenario lifecycle observer and matching](https://github.com/android/android-test/blob/main/core/java/androidx/test/core/app/ActivityScenario.java).
The retained installed binary, rather than the current upstream branch, binds the
actual local dependency version. No infrastructure or production resources changed.
