#!/usr/bin/env bash
set -u
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$repo_root/android/app/build/outputs/focused-safety-ui"
mkdir -p "$output_dir" || exit 1
device_receipt="$output_dir/disposable-device-setup.json"
node "$repo_root/scripts/qa/configure-disposable-android.mjs" > "$device_receipt" || exit 1
restore_test_device() {
  suite_status=$?
  restore_status=0
  node "$repo_root/scripts/qa/restore-disposable-store.mjs" "$device_receipt" > "$output_dir/disposable-store-restore.json" || restore_status=$?
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_device EXIT
node "$repo_root/scripts/qa/activate-disposable-installations.mjs" "$device_receipt" > "$output_dir/disposable-installations-activated.json" || exit $?

emergency_identity_status=0
node "$repo_root/scripts/qa/run-local-emergency-identity-ui.mjs" || emergency_identity_status=$?
printf '{"scope":"emergency-identity-command-status-not-flow-verification","status":%s}\n' \
  "$emergency_identity_status" > "$output_dir/emergency-identity-suite-status.json"
observation_status=0
node "$repo_root/scripts/qa/run-local-ride-observation-ui.mjs" || observation_status=$?
printf '{"scope":"ride-observation-native-command-status-not-flow-verification","status":%s}\n' \
  "$observation_status" > "$output_dir/ride-observation-suite-status.json"
startup_status=0
node "$repo_root/scripts/qa/run-local-native-startup-ui.mjs" || startup_status=$?
printf '{"scope":"native-startup-command-status-not-flow-verification","status":%s}\n' \
  "$startup_status" > "$output_dir/native-startup-suite-status.json"
remote_stop_status=0
node "$repo_root/scripts/qa/run-local-remote-ride-stop-ui.mjs" || remote_stop_status=$?
printf '{"scope":"remote-ride-stop-command-status-not-flow-verification","status":%s}\n' \
  "$remote_stop_status" > "$output_dir/remote-ride-stop-suite-status.json"
if [[ "$emergency_identity_status" -ne 0 ]]; then exit "$emergency_identity_status"; fi
if [[ "$observation_status" -ne 0 ]]; then exit "$observation_status"; fi
if [[ "$startup_status" -ne 0 ]]; then exit "$startup_status"; fi
exit "$remote_stop_status"
