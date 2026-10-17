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
