# Disposable Carrier Observation

The local connection-loss replay requires real Wi-Fi and cellular callbacks,
an exclusive cellular handover, complete disconnection, and a confirmed send
after restoration. A loaded SIM or a modem registered at home is not sufficient.
These requirements, the 30-second preparation deadline and the single execution
of the test remain unchanged.

Recent failed runs have a loaded, mapped SIM but no valid default data
subscription. Bounded default-selection log history is empty in both passing and
failing runs; it does not identify the failed initialization gate.

`local-carrier-diagnostics.mjs` adds a read-only `dumpsys carrier_config` snapshot
before and after that same network case. Android 15's
[CarrierConfigLoader implementation](https://android.googlesource.com/platform/packages/services/Telephony/+/refs/tags/android-15.0.0_r1/src/com/android/phone/CarrierConfigLoader.java)
prints the current number of phones and three boolean arrays used here:
`mHasSentConfigChange`, `mFromSystemUnlocked` and
`mServiceBoundForNoSimConfig`. The collector retains only their typed values,
the local run identifier, phase and observation time. It does not retain carrier
settings, package names, phone/subscription IDs, cached SIM filenames, arbitrary
logs, or raw command failures.

The parser requires the expected loader header, sequential phone sections,
exactly one occurrence of each state field, and matching bounded array lengths.
It ignores the local-log section rather than interpreting historical lines as
current state. Unknown/missing formats fail with a redacted error; they cannot
become an assumed healthy state. The command is bounded to 30 seconds and 2 MiB,
and requires the existing disposable-emulator and run-identity guards.

`configChangeSent` is a loader flag, not proof that the default-selection
controller received that change, passed its other gates or selected mobile data.
The observation does not change subscriptions, request a configuration reload,
alter radios, clear logs, change deadlines, retry a case, or qualify a failed
flow as passing. Actual carrier receipts are pending a fresh native run. This
is diagnostic coverage, not a provisioning repair or a completed release test.

The existing `local-default-selection-diagnostics.test.mjs` suite covers this
collector as well as controller history; both Native CI and Web Integration
Smoke already execute that suite and include `scripts/qa/**` in their triggers.
No infrastructure resource or production setting changes, so Terraform is not
affected.
