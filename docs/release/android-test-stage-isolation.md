# Android test-stage isolation

The complete disposable-device gate runs ordinary component tests, collects
their original evidence, then runs the isolated multi-person replay. A timeout
of the host's `adb` command is not proof that guest instrumentation has exited.

Before clearing local replay data, `prepare-matrix-replay.mjs` now:

1. Requires the existing explicit disposable-device approvals, Linux CI,
   full-matrix selection, ordinary claim and matching guarded four-APK receipt.
2. Claims the replay once, before any stop or local-data mutation.
3. Reads a bounded process-name inventory, stops only the two ordinary packages
   in test-before-app order, then verifies that neither they nor their named
   subprocesses remain.
4. Saves a fresh private `.replay-stopped.json` receipt beside the device receipt,
   before local data is cleared. Only owned-package counts are retained, not
   unrelated process names or command arguments.

The inventory uses `ps -A -w -o NAME`: NAME is the process name rather than the
full argument list, and wide output prevents truncation. See the
[Android command definitions](https://android.googlesource.com/platform/external/toybox/+/3b3281367ccb9f41ef952c7e1ad520fad4b792f0/generated/help.h).
Empty, malformed, unavailable or oversized inventory fails closed. Surviving
ordinary workers prevent replay. No retry, forced device reset, installation
window, fallback, test filter or deadline increase is introduced.

Ordinary app data and previously collected captures are not cleared. Unrelated
packages and the local app are not stopped. The existing suite runner still
preserves the original ordinary failure even if the later replay succeeds.
The new receipt is covered by the existing full-matrix artifact glob.

The regression models a surviving ordinary app, test process and subprocess
while keeping unrelated and local workers alive. It fails against the previous
preparation code and passes only once those ordinary workers are stopped before
local preparation. Negative cases cover surviving workers and malformed or
unavailable inventory, and refuse a second claim without repeating stops.

`tests/android-matrix-preparation.test.mjs` already runs in Native CI and Web
Integration Smoke. Both already watch the modified test and `scripts/qa/`
sources, so no workflow workload or path-filter change is required.

This is test orchestration, not a verified application-flow fix. The earlier
ordinary timeout and guardian-window focus failure have no established cause;
this change does not claim to explain or resolve them. A subsequent remote run
must retain its own original outcomes and stop receipt before remote execution
can be claimed. No physical-device, provider or release evidence is accepted.
