# Disposable Test Phone Installation Guard

## Activation And Cleanup Verified

The fresh run at `f95c8f7` now verifies the block during instrumentation and complete
administrator/helper removal, with maps/location preserved. Original receipts and
the later failed primary transfer are in `verified-2026-10-19/`. The team phase
passed; the whole matrix did not. Historical failed attempts below remain unchanged.

## Boot Readiness Refusal

[Run 39227739767](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39227739767)
at `23e040e3cb274cbd1602e5d195e454394c0670ed` compiled the corrected runner but
stopped before reaching it: device-owner provisioning returned the accounts-not-empty
error. The three original artifacts/hashes are retained in
`policy-readiness-failure/`. Setup output is empty and no flow was executed.
That message alone does not establish that the disposable image had accounts:
Android 15 returns the same failure while its boot account-compatibility cache
is not ready. The source confirms that a null cache is treated as incompatible.

Preparation now pauses the store first, waits read-only for the boot calculation
to finish, and requires explicit zero account counts before its first owner
attempt. Counts are filtered on-device; no account identity/authentication data is
retained and no account is removed. Actual account conflicts and unknown readiness
still stop the run. Failed setup now also emits typed cleanup receipts. A new
native run is required; the original refusal is not rewritten as a passed trial.

## Approved Administration Trial

The user approved temporary device administration on the disposable test phone
only on 19 October. In
[run 39226441823](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39226441823)
at `9d4435b0f2ba25aa41f49f599d9ac59fbf05e522`, setup installed the test-only helper,
confirmed its device-owner authority and performed the checked block/unblock
round trip. Final cleanup verified removal of both the administrator and helper,
and restoration of the original installation flag. Maps/location stayed enabled
and the map runtime version was unchanged.

The instrumentation runner still stopped before any user-flow test. The original
JUnit reports zero cases, the guard verification file is empty and cleanup says
`verified: false`, despite successful restoration. All six original artifacts and
hashes are retained in `admin-startup-failure/`; this trial is not a successful
user-flow replay. The runner had appended a shell exit marker to a `UiAutomation`
command, but Android executes that string with `Runtime.exec`, not a shell.
Commands now execute individually, using their typed outputs, and sanitized
failure-stage labels are retained. The corrected runner needs its own native run.

## Previous Failure

`previous-failure/` preserves five unmodified artifacts from
[Native CI run 39176652632](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39176652632)
at application commit `3ef2131b5e7b8f094114a5c96fe6c4d7832fa05d`, with their SHA-256 hashes.
The ordinary suite stopped after 122 records (34 skipped, one failure, zero
errors) with a test-process crash. The isolated replay later stopped during the
primary trip-input evidence transfer. Its early team case completed, but this
does not make the interrupted whole run successful or establish a stable device.
The cleanup receipt says `restored: true`, `verified: false`: the map runtime
version changed from `24.23.35` to `26.40.32` during the run. The failure log retains
that exact comparison. The installation block had not been approved or applied
in that run. Neither the map/version check nor the original suite failures are
removed by the new guard.

## Source History

The user explicitly approved blocking installations/updates on the disposable test
phone only and restoring its original setting after every run.

This directory retains two exact source snapshots from pushed application commit
`199c40a4cfad3926b24c0f8622636e0f0b8a2eb2`, before the installation-guard change:

- `prior-source/android-app-build.gradle.kts.txt`:
  `0e1d15aacce5c0df07d26ede7695d8ba33ad92a77245d14ca488da8e20bbe44c`.
- `prior-source/local-android-session.mjs.txt`:
  `d67de115a55109dc26dfcd846d0adbcdb341a13f9a2880624fc363b71f359b52`.

They preserve the actual source bindings in the earlier emergency-contact
scheduler and team-enrollment compile-only reports. Those original JSON, XML and
build logs remain unchanged. Their tests now compare these two superseded harness
files to the retained originals, while continuing to compare unchanged application
and domain files to current source. The reports do not prove the new installation
guard or imply a newly executed native case.

The guard's current unit checks cover the explicit emulator/user/image boundaries,
missing OS support, ignored policy writes, failed APK installation, runtime
mutation, restoration, and early stop before replay. The test APK also compiles
locally. Actual on-device activation and cleanup still require a fresh native CI
run. That scoped proof is now retained above; no physical-device or whole-run
success is accepted by this source archive.

The runtime and cleanup design and primary Android 15 source links are documented
in `scripts/qa/README.md`. No production, billing, Terraform, map-provider or
location configuration is changed.
