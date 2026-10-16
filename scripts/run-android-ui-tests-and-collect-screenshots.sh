#!/usr/bin/env bash
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
android_dir="$repo_root/android"
output_dir="$android_dir/app/build/outputs/store-review-screenshots"
remote_dir="/sdcard/Download/sgm-store-review"

node "$repo_root/scripts/qa/configure-disposable-android.mjs" || exit 1

set +e
"$android_dir/gradlew" -p "$android_dir" :app:connectedDebugAndroidTest --no-daemon --stacktrace
test_status=$?
set -e

mkdir -p "$output_dir"
if ! adb pull "$remote_dir" "$output_dir"; then
  echo "::warning::No Android store-review screenshots were pulled from $remote_dir"
fi

if [[ "$test_status" -eq 0 ]]; then
  adb pull /sdcard/Download/sgm-session-restoration "$output_dir" || exit 1
  for name in session-restoration-error.png session-restoration-narrow.png; do
    if [[ ! -s "$output_dir/sgm-session-restoration/$name" ]]; then
      echo "Missing session restoration screen: $name" >&2
      exit 1
    fi
  done
  screenshot_count="$(find "$output_dir" -type f -name "store-*.png" -size +0c | wc -l | tr -d " ")"
  if [[ "$screenshot_count" -lt 8 ]]; then
    echo "Expected at least 8 non-empty Android store-review screenshots, found $screenshot_count." >&2
    exit 1
  fi
fi

if [[ "$test_status" -eq 0 ]]; then
  node "$repo_root/scripts/qa/run-local-android-flows.mjs"
fi

exit "$test_status"
