# Disposable Test Phone Installation Guard

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
run; no physical-device or whole-run success is accepted by this source archive.

The runtime and cleanup design and primary Android 15 source links are documented
in `scripts/qa/README.md`. No production, billing, Terraform, map-provider or
location configuration is changed.
