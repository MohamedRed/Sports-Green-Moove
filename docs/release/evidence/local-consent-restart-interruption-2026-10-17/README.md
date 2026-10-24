# Interrupted Consent-Restart Replay

- Source head: `7f19b643c76f737321a85fd072252e1ba08186c2`.
- Native run: `39069735693`; Android UI job: `117504672426` (failed).
- Artifact: `12115445867`; local run: `3648702d1ab2ab208e428bd9c10c6bac`.
- Failure timestamp: `2026-10-17T21:23:00.738Z`.
- The new confirmed-consent restart stage was not reached. No full replay
  `results.json` exists for this run and no new flow is accepted from it.

`original/` retains six unchanged artifact files and their SHA-256 inventory.
The Java crash buffer is empty. The OS exit record identifies app PID 7818 as
force-stopped because starting `com.google.android.gms` failed. The process log
records `Package com.google.android.gms is currently frozen!`, followed by the
dependent app being killed and its instrumentation being terminated.

This explains the immediate termination, not what froze the package. There is
no installer/session dump in this artifact, so an in-flight update is not proven.
The earlier completed 27-group replay remains historical evidence; it does not
prove the newly required 28th group or fix this interruption.

Android's [package-freezing implementation](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/services/core/java/com/android/server/pm/PackageFreezer.java)
guards package code/data operations. Its
[dump commands](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-15.0.0_r1/services/core/java/com/android/server/pm/DumpHelper.java)
provide `frozen` and `installs` diagnostics. The next failed instrumentation now
collects those plus timestamped package-operation logs. Installation details are
restricted to typed package names, session identities, timestamps and state;
URIs, paths and free-form installer messages are excluded. Collection is bounded,
read-only, disposable-emulator-only and cannot turn a failed test into success.

Separately, the same-head provider readiness job `117504672234` in run
`39069735654` failed to reach the configured refresh callback. Both configured
callback health endpoints returned the required HTTP 204 contracts from the
development host afterward. That does not explain the CI network failure.
Readiness diagnostics now distinguish safe timeout/DNS/connection categories
without disclosing underlying errors, changing the 15-second timeout or retrying.

## Package Update Identified On The Next Run

Run `39071331815`, job `117509404110`, at source `6c787e2bad8c3a8d73f9eb0cd8ae55ca377b2046`
failed at the same booking-recovery case. Artifact `12114699737` contains local
run `493fcbaef51a1c79c06a99247ae441a0`; its nine original diagnostic/transcript
files and SHA-256 inventory are retained under `package-update/`.

At 21:45:17.599 UTC the package manager continued install session `572905264`.
At 21:45:17.708 it explicitly logged updating the system `com.google.android.gms`
package. The active, committed, sealed installation identifies that same package
and `com.android.vending` as its initiating/original installer. The frozen-package
dump has a reference count of one for it. At 21:45:21.486 Android force-stopped
dependent app PID 7862 because that service could not start. All seven diagnostic
queries completed. This run therefore establishes an in-flight package update
as the immediate interruption, not merely a hypothesized memory or Java crash.
One historical installer package label is partial; it is not used for that
identification. Future typed collection joins line-wrapped values before parsing.
The consent-restart stage still was not reached, and no full result is accepted.

The subsequently rejected setup attempted Android's documented
[Test Harness Mode](https://source.android.com/docs/core/tests/debug/harness)
on the fresh hosted CI emulator only, before any test-app installation. It makes
one explicit reset request, requires a different completed boot, and verifies the
test-mode property and automatic system-update setting. It then retains the
existing enabled Play Store/Play services and Maps version checks. It refuses
local/self-hosted/physical targets, pre-existing third-party apps and unsupported
or incomplete setup. There is no reset or test retry, image substitution or
silent ordinary-device continuation. Runtime effectiveness against this Play
services update remains to be verified; Android's system-update setting alone
does not prove that no app package will update.

## Reset Mode Rejected

Run `39072735641`, Android job `117513519478`, source
`b1e81f92231ff06372b16b3cd8f41c127aae4ba6`, stopped at setup at
21:54:21 UTC: `cmd testharness enable` returned exit 1 and
`Failed to enable Test Harness Mode`. No ordinary/local app test ran there.
The unsupported reset helper, tests and workflow opt-in have been removed. The
job did not fall through to a different setup and is still recorded as failed.
A boot-property alternative was reviewed in source only and not run or retained;
support on this image was not established. The existing image/rendering options
and enabled Play Store/Play services prerequisites are preserved. No successful
update-interruption fix or 28-group replay is claimed. Approval has been requested
before pausing the disposable device's app store during a future test session.

## Separate Evidence-Transport Interruption

Run `39071818707`, job `117510827092`, source
`e7506b4b4ea8bf5ec86bc684205f65ebbd30319a`, reached the parent-confirmation case
but failed its named evidence copy at 21:57:18 UTC. The cleanup copy failed too.
Artifact `12116216244`, local run `134bfdf6168c8705cb18b573726d3466`, retains both
status-1 receipts under `evidence-transport/`. The first stopped while building
the file list; cleanup stopped during a PNG transfer. Both used ADB 37.0.1.
No timeout, signal or subprocess error code was reported. These facts do not
establish the underlying transport cause or permit an alternate copy/retry to be
counted as success. Consent restart was not reached and no full result is accepted.

## Driver Review Action In The Restart Test

Run `39073414714`, job `117515536515`, source
`8a6164a9053cfe47965058625e218afb4213fa77`, reached the new restart case.
Artifact `12116706372`, local run `53e6af18b205707881ff4af32855c63d`, preserves
the original preparation/checkpoint/stop records, both native transcripts, failed
after receipt, device diagnostics and reviewed parent-after image under
`driver-review-action/` with a byte/hash inventory.

The native assertions passed parent session restoration without login, the same
proposal and saved decision, absent duplicate decision controls, and two explicit
refreshes. The after receipt nevertheless has `completed: false`. At 22:17:13 UTC
the test timed out looking for `trip.edit.<id>` after switching to the driver.
The app correctly offers `trip.review.<id>` while a proposal exists; the older
three-account consent test already uses that review action. This is a test-action
error, not evidence of a broken account switch or a reason to change the app's
edit/review policy.

The corrected test requires no pending proposal before its initial edit and the
exact prepared proposal before the later review. It selects the appropriate
existing action and asserts that the opposite action is absent. All original
post-stop session, consent, driver-account, unchanged-record, scoped-access and
ride-start assertions remain mandatory. The host's final independent snapshot,
complete stage receipt and full 28-group result were not reached in this failed
run. No restart requirement or new gallery screenshot is accepted from it.

The subsequent [completed 28-group replay](../local-trip-consent-restart-native-2026-10-17/README.md)
verifies the corrected confirmed-consent restart case. These failed originals
retain their failed status; that later pass does not resolve the independent
update, evidence-transport or earlier keyboard interruptions.

## Copy Failure With Device Diagnostics

Run `39076934577`, job `117525916519`, source
`7d984812231176f6d0ac5cfc4d01c7ea25684d37`, stopped at the named
parent-confirmation evidence copy at `2026-10-17T23:12:27.755Z`. Artifact
`12117826462`, local run `056f9cdedafa1f214f4b12b22a058756`, retains 13 unchanged
records under `copy-with-diagnostics/` with a SHA-256 inventory.

The native parent-confirmation method reported `OK (1 test)` and a completed
screen receipt, but the required copy returned status 1 while building its file
list. ADB was `37.0.1-15733141`; signal and subprocess error code were null. All
seven device queries then completed. The crash buffer and package-operation log
were empty; no package was frozen and no install session was active. The most
recent app exit was the expected instrumentation finish/force-stop, not a Java
crash or low-memory kill. Historical package updates do not establish an update
at this copy failure.

The separately named cleanup copy returned status 0 with 52 files. It recovered
diagnostic files but did not repair or retry the failed primary boundary: the
suite still records local replay exit 1, and host verification after that boundary
and both consent-restart stages were not reached. There is no full `results.json`
or new accepted gallery capture from this run.

These records narrow the immediate observations, not the transfer cause. The
existing process diagnostics do not capture a host ADB server log or a guest
file-sync protocol trace. A successful later run cannot prove the intermittent
copy issue fixed. No transfer substitution, compression change or retry is
introduced on this evidence.

## Recovery Test Acted Before The Action Was Ready

Run `39077535206`, job `117527691482`, source
`ef72644ac921befee1c8698836a3b4b6a2fbe74d`, reached preparation of the new
four-state recovery matrix. Artifact `12118331594`, local run
`aa828e143677a3827a4ce37de85a7cc7`, retains 13 original records under
`recovery-action-readiness/` and their SHA-256 inventory. At 23:25:10 UTC the
native test failed because `trip.change.withdraw` was absent immediately after
the withdrawn fixture's proposal. The preparation receipt remains incomplete;
no matrix checkpoint, stop, reopen, full result or new gallery proof is accepted.

The production state deliberately keeps actions unavailable while its proposal
operation finishes refreshing the surrounding app. `propose` stores the returned
review before awaiting `onChanged`; `canWithdraw` requires `!busy`. The dialog can
therefore show the pending status before the withdrawal button is rendered. The
new test waited only for that status and attempted the action too early. This is
a test readiness defect, not evidence that withdrawal or account switching is
broken. A controlled delayed-refresh unit case reproduces the status/busy/action
sequence and requires only one proposal and one later explicit withdrawal.

The corrected native helper requires the expected status, completion of the
existing busy state and no error before proceeding. Initial editor/review entry
and explicit refresh also wait for the same completion state. No fixed sleep,
alternate control, action retry, production-code change or weaker requirement is
introduced. The full 32-group replay must still prove the corrected test.

Earlier in this same run, confirmed-consent restart completed at
`2026-10-17T23:24:39.816Z` with different processes 10498/10654 and matching full
record hashes. Its retained stage explicitly has `fullAppReplay: false`. That
narrow repeat does not prove the four new cases or make this failed run complete.
