# App Build Left The Booted Device Waiting

Native CI run [39175506047](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39175506047)
tested `3a3077841b7f9d760c065374f3b778a0c5cef6f7` on 18 October 2026.
Three unchanged original artifacts are bound by `artifact-sha256.json`, including
the zero-byte setup receipt. No ordinary or connected team test ran in this job.

The emulator booted before app compilation. The build then took **6m 13s** and
succeeded at 23:20:39 UTC. The setup guard subsequently observed an active store
installation and refused to interrupt it or start the replay. No successful setup,
store pause, test execution or restoration is claimed. The launcher-isolation
operation precedes the store guard; this is not a claim that setup performed no
device mutation. The disposable emulator was terminated by the runner.

All other requested current-head checks passed: backend, web integration smoke,
native unit, native configuration and release static checks. The overall native
job remains failed. Host transfer diagnostics were not reached because this
failure happened at setup, before either guarded suite or capture transfer.

## Root-Cause-Oriented Ordering Change

The Android UI job now compiles both APKs **before** booting the disposable device,
using exactly the same map configuration as the later wrapper. The wrapper retains
its build gate before device mutation; the already compiled tasks should be
up-to-date there. This removes the avoidable six-minute unpaused compilation
window. It does not claim to prevent an installation that starts during boot.

The existing active-install refusal, reversible background-only store policy,
maps/location checks, emulator image, full test matrix, capture requirements and
cleanup remain unchanged. No installation is interrupted; no install-blocking
restriction, fallback, retry or longer timeout is added. Actual effectiveness
requires a new complete run and retained evidence. The previous transport-loss
failure remains separately documented and is not declared fixed by this change.
