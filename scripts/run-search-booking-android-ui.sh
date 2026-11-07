#!/usr/bin/env bash
set -u
test "${SGM_SEARCH_BOOKING_APPROVAL:-}" = one-trial-max-eight-requests || exit 2
test "${GITHUB_RUN_ATTEMPT:-1}" = 1 || exit 2
export SGM_FOCUSED_UI_CASE=parent-search-booking
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$repo_root/android/app/build/outputs/parent-search-booking-device"
mkdir "$output_dir" || exit 1
device_receipt="$output_dir/disposable-device-setup.json"
node "$repo_root/scripts/qa/configure-continuous-disposable.mjs" > "$device_receipt" || exit 1
restore_test_device() {
  suite_status=$?
  restore_status=0
  node "$repo_root/scripts/qa/restore-continuous-disposable.mjs" "$device_receipt" > "$output_dir/disposable-device-restore.json" || restore_status=$?
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_device EXIT
export SGM_PREINSTALLED_TEST_APKS_RECEIPT="$device_receipt"
export SGM_LOCAL_UI_OUTPUT="$repo_root/android/app/build/outputs/parent-search-booking-evidence"
flow_status=0
node "$repo_root/scripts/qa/run-search-booking-ui.mjs" --approved-one-trial-max-eight-requests || flow_status=$?
printf '{"scope":"parent-search-booking-command-not-flow-proof","status":%s}\n' "$flow_status" > "$output_dir/suite-status.json"
exit "$flow_status"
