# Disposable Launcher Restoration

The ordinary Android test setup disables the home launcher so its independent
crash does not interrupt activity-driven tests. It must restore that exact
launcher on both setup failure and final cleanup. A selected store pause is not
a prerequisite for launcher restoration.

Setup first verifies that the known launcher is installed and enabled on the
explicitly disposable emulator. The returned receipt records its original
enabled state. A missing/unknown original state or a different device/launcher
is rejected before restoration, not replaced with an assumed default.

The setup try/catch now encloses the disabling command itself. If that command
changes the phone and then fails, its original sanitized error remains first
while independent rollback enables and verifies the launcher. Store/admin
cleanup failures do not suppress this attempt. A failed or ignored enable is
not retried or accepted as restored.

Final cleanup similarly attempts all selected store, administrator and launcher
restorations. `launcherRestored` participates in both `restored` and `verified`.
The entry point no longer skips cleanup when `storePause` is null; it records
that no store operation was selected and still restores the changed launcher.

The historical `3904dd80` preparation receipt proves store restoration only.
It has no launcher restoration proof and is not promoted by this source fix.
`tests/disposable-launcher-cleanup.test.mjs` exercises the actual helper and
restoration functions with isolated command/state fixtures. The failed-disable
test covers the real setup error/rollback ordering. Native and web smoke paths
run this coverage. Actual new-source emulator restoration remains to be observed.
No production resource, personal device, provider, location runtime or billing
setting is changed; no Terraform update is required.
