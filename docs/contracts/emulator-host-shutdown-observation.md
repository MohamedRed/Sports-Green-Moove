# Read-Only CI Emulator Shutdown Observation

The completed `a6d8a630` ride-observation case and cleanup do not prove host
process exit. The upstream action acknowledged `adb emu kill`, then produced no
next step before cancellation. Its final runner log terminated orphan QEMU,
crash-reporting and network-simulator processes. This is evidence of surviving
host processes, not a confirmed QEMU defect or application failure.

The exact upstream revision was
[`a421e43855164a8197daf9d8d40fe71c6996bb0d`](https://github.com/ReactiveCircus/android-emulator-runner/blob/a421e43855164a8197daf9d8d40fe71c6996bb0d/src/emulator-manager.ts).
It starts the engine in the background and sends the shutdown command; it does
not independently verify process exit. Similar upstream reports, including
[issue 385](https://github.com/ReactiveCircus/android-emulator-runner/issues/385),
do not establish this run's underlying cause or justify their proposed workarounds.

## Scope

After the existing focused-device restoration succeeds, the Linux CI shell
starts a read-only observer. It binds exactly one QEMU executable with the
upstream `test` AVD and selected even-numbered console port. PID and Linux start
ticks bind the identity; disappearance never selects another process. Ambiguous,
malformed, foreign or unreadable targets remain unavailable. Personal/local
machines and unapproved contexts fail before writing or spawning an observer.

The observer retains up to 90 seconds of bounded process snapshots, with a
one-second identity probe and detailed samples no more often than every 15
seconds. Only process state, bounded kernel wait-channel names, known direct
QEMU children and output-stream kinds are retained. Raw arguments, environments,
process command names, file paths, packets, request bodies and device logs are
not recorded. The binding step reads command arguments only to verify the exact
AVD/port and never serializes them. A replaced PID stops observation.

The owned worker has ignored standard streams and is unreferenced, so it cannot
hold the upstream action's output pipes open. A later always-run step waits at
most 95 seconds for its fixed diagnostic result before artifact upload. Missing
diagnostics do not replace original application or cleanup outcomes. Existing
focused-case and overall release gates remain strict.

No signal, forced stop, restart, device command, alternate renderer/version,
test retry, provider fallback or new resource is introduced. No Terraform
change is required. This prepares the next diagnostic run; it is not a claim
that the real observer ran, shutdown recovered, or the release is ready.

## Verification

`tests/emulator-host-observation.test.mjs` covers synthetic Linux process records,
identity replacement, ambiguous selection, discarded sensitive fields, missing
metadata and CI wiring. The actual shell harness verifies that diagnostic
success/failure never masks the original flow/restore result. Both Native CI and
Web Integration Smoke run these tests without launching a paid phone.
