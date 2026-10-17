# Default Data Selection Diagnosis

The booking replay remains independently successful, but the complete Android
run is not passing. This investigation must not replace connection-loss evidence
with registration state, a loaded SIM, controller logs or a different route.

## Retained Failure

[Native CI 39018369431](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39018369431)
on `a59978ea7ecc260603ee2258aa5cd060fe93293e`, run
`534e47a793145a3b8e51f08c3ae1cc08`, failed at the unchanged 30-second
`network-preparation` wait. The original instrumentation and sanitized app,
subscription and modem observations are retained here without rewriting them.
No disconnect was reached: the app receipt has an empty transition list and
completion false. Before and after the case, modem registration was `home` and
the subscription service reported a loaded SIM, one mapped slot and all
subscriptions loaded. Nevertheless default voice/data/SMS and active data
subscription validity were false. The app independently reported no default data
subscription and no cellular callback. These observations narrow the problem
but do not establish why the OS never selected the data subscription.

## Read-Only Controller History

Android 35's [MultiSimSettingController source](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/+/refs/heads/androidx-constraintlayout-release/android-35/com/android/internal/telephony/MultiSimSettingController.java)
separately checks subscription initialization, carrier configuration loading and
satellite state before reevaluating default selection. A loaded SIM alone does
not establish that these gates passed. These are diagnostic hypotheses, not a
claim about which gate failed in the retained run.

The new collector reads only this controller's existing main/radio/system log
history using the documented [logcat allowlist and brief format](https://developer.android.com/tools/logcat).
It retains at most 128 allowlisted enum/boolean events from a bounded 2048-line
read, plus recognized/unrecognized counts and the last observed readiness event.
Subscription IDs, phone IDs, process IDs, arbitrary log text and raw command
failures are never written. Missing history is explicitly null, not healthy.
The result describes bounded historical observations, not current OS readiness.
It cannot qualify a connection-loss test as passing.

Fresh native runs collect the history immediately before and after the existing
network case. Device identity and disposable-emulator guards remain mandatory.
No radio, SIM defaults, logging properties, buffers, test deadline, route,
acceptance assertion or application behavior is changed. No retry, restart,
skip or alternate path is introduced. Four focused diagnostic tests and the
complete 74-case isolation/configuration suite pass locally. Actual device
controller evidence remains pending until the new native run completes.
