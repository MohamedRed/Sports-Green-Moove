# Generated-File Transport Diagnostic

This independent job investigates the repeated primary `adb pull` disconnect.
It is not a replacement for Native CI, an app flow, or release evidence. It uses
the same Android 35 Play Store image, Pixel 6 profile and supported software
renderer as the full matrix. No product app, account, booking, map request or
payment is involved. The system image and platform tools are not downgraded.

The job uploads three generated binary files once, then performs 32 predefined
primary directory transfers to separate fresh destinations. Each successful
command must return exactly the expected filenames, lengths and SHA-256 hashes.
The first failed command or byte comparison ends the sequence. No retry,
connection reset, alternative copy method or screenshot fallback is allowed.
Original per-trial JSON receipts are immutable. Cleanup is independently checked
and cannot turn a failed primary transfer into success.

Transport tracing is enabled only on this separate, account-free disposable
runner. Raw daemon logs and packet payloads are never uploaded. A bounded owned
daemon-log tail is reduced to allowlisted failure counts. In AOSP's transport
implementation, message-read termination, data-read termination, overflow and bad
headers are distinct paths. The app-process `MSG_PEEK` closure is not one of
these transport observations:

- [ADB transport implementation](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/transport.cpp)
- [App-process connection server](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/libs/adbconnection/adbconnection_server.cpp)

A diagnostic failure can establish reproduction without the app. A diagnostic
pass only means these 32 transfers passed; it does not disprove an intermittent
failure or establish the root cause. No release manifest entry is promoted.

The [first CI attempt](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40697049828)
at `03c6941` stopped with `ENOENT` before the probe's first device command: the
clean checkout had no app-build output parent. The probe now creates that parent
without compiling or installing the app, while still refusing an existing result
directory. A clean-checkout regression reproduced the failure before this fix.
This preparation fix is not a repair of the original ADB disconnect.

The [second attempt](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40697516691)
at `c57555e` stopped inside the emulator action's initial animation configuration
with ADB exit 255, before the probe script started. It produced no trial receipts.
That is a separate preparation failure, not reproduction of the original copy
failure. Neither failed attempt is hidden or converted into a passing transfer.
Path absence now requires a successful `test ! -e` device command: an offline
error's exit 1 cannot authorize creating or later deleting a remote directory.

Run the contract tests with `node --test tests/adb-transfer-probe.test.mjs`.
The dedicated workflow runs these contracts before starting the device, and
uploads only its JSON outcomes. Web Integration Smoke is unchanged because this
job contains no web, service or product code and owns its own contract check.
No cloud infrastructure is created, so no Terraform change is needed.

At `063efab`, [run 40709878812](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/40709878812)
reproduces the transfer failure without the product app: five exact-byte pulls
pass and the sixth exits 1, with increased host transport-read failure counts.
Original receipts and their original source snapshots are retained under
`docs/release/evidence/generated-transfer-failure-063efab-2026-10-28/`.
Remote fixture removal and absence are not verified in that failed run.

The probe now captures the existing passive host process/socket observation
before transfers and after their terminal result, before cleanup. It retains
only selected ADB process identities, same-user loopback socket metadata and
allowlisted daemon events. No process arguments, environments, raw command
errors or logs are retained. Fixed command-error classifications distinguish
offline/missing devices, transport closure, permission/space errors and timeout.
These observations cannot alone establish a disconnect's root cause and do not
change any command, retry, renderer, tool version or release acceptance rule.
