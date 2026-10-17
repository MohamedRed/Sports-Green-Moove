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
controller evidence was pending until the run below completed.

## Executed Comparison

[Native CI 39019704514](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39019704514)
on `679e05918821066364b3ab4884de1f766f80c453` completed run
`cf2ba260731eb634ae9f9b9c143ba656` at `2026-10-17T09:20:14.276Z`.
The original `completed/results.json` contains 24 executed cases and 24 successful
groups. All 16 raw instrumentation transcripts are retained and sum to 24 cases.
The ordinary component suite declared 88 cases: 69 passed, 19 conditional cases
skipped, zero failures/errors (`completed/general-ui.xml`).

The fresh network receipt proves the stricter version-1 handover: both active and
all Internet transports are exclusively cellular in the exact readiness sample,
followed by no active network, zero Internet networks, both radios disabled and
an unreachable isolated backend. After restoration the app sends the retained
draft, receives acknowledgement and the peer reply. Independent saved-data
verification reports two messages, two notifications and no duplicates. Account
draft isolation also passes. The reviewed unconfirmed/replied captures are
original app content from this completed run; no new video was recorded.

The full run also independently verifies the real booking search-screen retry
with explicitly stubbed matching, one booking/receipt and two calls. Its separate
SDK-only booking process-restart stage remains separately scoped. Neither is
promoted to search-screen restoration, actual provider matching or physical GPS.

The new before/after controller-history receipts contain **zero retained events**
and `lastReadiness: null`. The parser did not invent a healthy state. The service
and app observations show valid default/active data subscriptions in this working
run, unlike the retained failure. There is no evidence here identifying which
selection gate failed earlier, whether logs were suppressed, or whether earlier
entries had left the bounded log buffers. The collector is diagnostic plumbing,
not a provisioning repair. One successful run does not establish reliability.

The private portal points the message flow to this completed local replay while
preserving the failed run and the original dates of older captures. Real phones,
pending-draft process death, token expiry, groups, payment/provider integration,
physical tracking and real safety-audit evidence remain incomplete. There is no
production deployment, test skip, deadline increase or alternate network route.
