#!/usr/bin/env bash
set -eu
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$repo_root/android/app/build/outputs/vehicle-map-ui"
mkdir -p "$output_dir"
test "${SGM_VEHICLE_MAP_UI:-}" = approved-sdk-map

device_receipt="$output_dir/disposable-device-setup.json"
node "$repo_root/scripts/qa/configure-disposable-android.mjs" > "$device_receipt"
restore_test_device() {
  suite_status=$?
  restore_status=0
  node "$repo_root/scripts/qa/restore-disposable-store.mjs" "$device_receipt" > "$output_dir/disposable-store-restore.json" || restore_status=$?
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_device EXIT
node "$repo_root/scripts/qa/run-local-vehicle-map-ui.mjs"
