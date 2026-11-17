# Contact Wait Synchronization And Separate Device Interruption

## Executed Local Regression

Three `EmergencyContactSchedulerTest` JVM cases actually passed. The original
JUnit XML and source fingerprints are retained in `build-checks.json`:

- A callback completes on another thread, but the actual contact state's dial
  continuation remains queued until its test scheduler is advanced.
- Advancing the scheduler still refuses a failed fresh-authority read and
  clears the contact instead of opening a phone action.
- A changed destination remains visible for review and cannot open on that tap.

The contact replay used `StandardTestDispatcher` for its Compose effects but
waited for the external phone window with `UiDevice.wait`. That wait does not
advance the Compose clock. The last read in run `39155710166` finished at
18:58:20.173 UTC, followed by the 60-second phone timeout. The unit reproduction
establishes the scheduling defect; without that run's pre-teardown window/intent
capture, it does **not** establish that this was its only native failure cause.
[Android's synchronization guidance](https://developer.android.com/develop/ui/compose/testing/synchronization)
requires a Compose-aware wait for externally completed work.

`awaitLocalExternalUi` now polls the exact same resolved-package condition through
Compose's `waitUntil`, with the same 60,000 ms wall-clock deadline. The actual
package, visible fictional destination, `ACTION_DIAL` count, zero direct-call
count, return, removal and account-isolation assertions remain. The app's phone
implementation is unchanged. No shell launch, alternate phone app, permission
grant, longer timeout or provider fallback is introduced.

Three native regression cases compile: callback continuation, original timeout
preserved when diagnostics also fail, and a diagnostic failure remaining a
failure even when the window predicate is true. They have **not executed** yet.
The test APK build and local unit task completed successfully; this is not native
phone-handoff, physical-device or complete app replay evidence.

## Later Diagnostic Run Never Reaches The Contact

[Run 39157444338](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39157444338)
at `fa8e7c79830e457d0f267bc95b3782c8012b8ddc` failed separately during the ordinary
large-text trip-change case. Its original suite reports 127 discovered cases,
one failure and 33 skipped cases; it did not finish the ordinary suite. The
retained sanitized excerpt identifies test PID 5003, a `googlecertificates` module
configuration restart, and SIGKILL of that same PID at 19:21:41.037 UTC.
The full source log's SHA-256 and original line numbers are recorded without
copying unrelated store telemetry. This repeats the previously observed module
restart failure; it is not a contact or layout assertion failure.

The device then reported offline. Local SDK replay did not start, and store
restoration could not select an available emulator. The original restore file is
empty, not a successful JSON receipt. No restore success, contact-attempt capture,
contact marker, 35-group result or phone opening is invented. The four hashed raw
artifacts remain under `native-interruption/`.

The owner has been asked whether to temporarily block installations/updates on
only the disposable test phone. No such restriction has been applied without
their answer. Maps, location and the currently approved pause remain unchanged.
Historical 34-group success and the four earlier contact observations are retained
separately. Production, physical tracking, child-own-account access and safety
audit requirements remain open.
