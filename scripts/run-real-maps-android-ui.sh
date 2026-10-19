#!/usr/bin/env bash
set -eu
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
android_dir="$repo_root/android"
output_dir="$android_dir/app/build/outputs/real-maps-ui"
mkdir -p "$output_dir"

env -u SGM_REAL_MAPS_SERVER_KEY "$android_dir/gradlew" -p "$android_dir" :app:assembleDebug :app:assembleDebugAndroidTest :qa-install-guard:assembleDebug \
  -PSGM_USE_FIREBASE_EMULATOR=true -PSGM_LOCAL_REAL_MAPS_UI=true --no-daemon --max-workers=2

device_receipt="$output_dir/disposable-device-setup.json"
env -u SGM_REAL_MAPS_SERVER_KEY node "$repo_root/scripts/qa/configure-disposable-android.mjs" > "$device_receipt"
restore_test_store() {
  suite_status=$?
  restore_status=0
  env -u SGM_REAL_MAPS_SERVER_KEY node "$repo_root/scripts/qa/restore-disposable-store.mjs" "$device_receipt" > "$output_dir/disposable-store-restore.json" || restore_status=$?
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_store EXIT
SGM_REAL_MAPS_UI_OUTPUT="$output_dir/replay" node "$repo_root/scripts/qa/run-real-maps-android.mjs" --approved-isolated-real-maps
