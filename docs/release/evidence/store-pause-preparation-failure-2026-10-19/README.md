# Initial Store Pause Failure

Native CI run 39262124854 at source
707dd744cf31c4678e0c4792339148414cac56a8 failed during disposable Android 15
preparation, before either native suite or the isolated app replay. App/test/helper
compilation passed. The original uploaded artifact contains only the build-status
and failed-device-setup JSON files retained here. `job-error-excerpt.txt` preserves
the exact original error section, with its timestamps, without repackaging it as
a completed flow. The failure is `Store pause was not applied` at the stopped-state
assertion. The store-pause routine attempted to restore the original background
and stopped settings, but its outer receipt lost that observation and retained
only null cleanup values. Neither successful nor failed restoration is proven by
those null fields. No app screen, new contact handoff or release gate is accepted.

The cause of the package's unconfirmed stopped state is not yet established.
The earlier boot log also contains offline ADB observations; those do not prove
the cause of this later assertion. A previous successful run cannot replace this
failure. `results.json` retains those scope and uncertainty boundaries, exact
source hashes and the original source run. Artifact hashes bind the original
receipts and error excerpt independently of the later diagnostics change.

The new implementation retains the original policy, exact failed stage, actual
stopped/background observations and independent rollback results. The outer setup
receipt now carries that nested failure. One bounded read of process-event logs
retains only public store process metadata for user 0, not other app names,
hosting-component payloads or raw logs. Unavailable diagnostics remain explicit.
The event layout follows the primary
[AOSP process-event schema](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android14-security-release/services/core/java/com/android/server/am/EventLogTags.logtags).
Event history alone does not establish why or when the stopped state changed.

This is a diagnostic correction, not a proven device-stability fix. The same
initial stop assertion, no-active-install check, map/location requirements,
restoration and failure semantics remain in place. There is no retry, alternative
image, disabled protection or new fallback. Unit tests cover false observations,
failed rollback, outer receipt propagation, bounded/redacted diagnostics and
diagnostic unavailability. Actual execution with the new diagnostics is pending.
