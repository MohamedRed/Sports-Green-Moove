#!/usr/bin/env bash
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
android_dir="$repo_root/android"
output_dir="$android_dir/app/build/outputs/store-review-screenshots"
remote_dir="/sdcard/Download/sgm-store-review"

mkdir -p "$output_dir" || exit 1
"$android_dir/gradlew" -p "$android_dir" :app:assembleDebug :app:assembleDebugAndroidTest :qa-install-guard:assembleDebug --no-daemon --stacktrace
build_status=$?
printf '{"scope":"native-build-before-device-policy-not-flow-verification","status":%s}\n' \
  "$build_status" > "$output_dir/native-build-status.json"
if [[ "$build_status" -ne 0 ]]; then exit "$build_status"; fi

device_receipt="$output_dir/disposable-device-setup.json"
node "$repo_root/scripts/qa/configure-disposable-android.mjs" > "$device_receipt" || exit 1
restore_test_store() {
  suite_status=$?
  restore_status=0
  node "$repo_root/scripts/qa/restore-disposable-store.mjs" "$device_receipt" > "$output_dir/disposable-store-restore.json" || restore_status=$?
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_store EXIT

set +e
ordinary_command=("$android_dir/gradlew" -p "$android_dir" :app:connectedDebugAndroidTest --no-daemon --stacktrace)
if [[ "${SGM_BLOCK_TEST_PHONE_INSTALLS:-false}" == "true" ]]; then
  ordinary_command+=("-Pandroid.testInstrumentationRunnerArguments.sgmBlockInstallations=true")
fi
"${ordinary_command[@]}"
test_status=$?
set -e

node "$repo_root/scripts/qa/verify-disposable-installations.mjs" "$device_receipt" > "$output_dir/disposable-installations-verified.json"

if [[ "$test_status" -ne 0 ]]; then
  if ! node "$repo_root/scripts/qa/collect-ordinary-android-failure.mjs" "$output_dir/ordinary-failure"; then
    echo "::warning::Could not collect ordinary-suite process diagnostics; original test failure is preserved"
  fi
fi

collect_component_evidence() {
  mkdir -p "$output_dir" || return 1
  if ! adb pull "$remote_dir" "$output_dir"; then
    echo "::warning::No Android store-review screenshots were pulled from $remote_dir"
    if [[ "$test_status" -eq 0 ]]; then return 1; fi
  fi

  if [[ "$test_status" -ne 0 ]]; then
    mkdir -p "$output_dir/partial-components" || return 1
    for directory in sgm-trip-changes sgm-payment-confirmation sgm-session-restoration sgm-booking-review sgm-booking-feedback sgm-emergency-contact sgm-team-enrollment sgm-team-history sgm-child-emergency-components sgm-neutral-text; do
      if adb shell test -d "/sdcard/Download/$directory"; then
        if ! adb pull "/sdcard/Download/$directory" "$output_dir/partial-components"; then
          echo "::warning::Could not collect partial component screenshots: $directory"
        fi
      fi
    done
  fi

  if [[ "$test_status" -eq 0 ]]; then
    adb pull /sdcard/Download/sgm-neutral-text "$output_dir" || return 1
    for screen in search trips; do
      for theme in light dark; do
        for format in phone wide; do
          for suffix in .png -window.png .json; do
            if [[ ! -s "$output_dir/sgm-neutral-text/$screen-$theme-$format$suffix" ]]; then
              echo "Missing neutral text evidence: $screen-$theme-$format$suffix" >&2
              return 1
            fi
          done
        done
      done
    done
    adb pull /sdcard/Download/sgm-child-emergency-components "$output_dir" || return 1
    for stem in child-emergency-readonly-narrow child-emergency-access-denied child-emergency-landscape-changed; do
      for suffix in .png -window.png; do
        if [[ ! -s "$output_dir/sgm-child-emergency-components/$stem$suffix" ]]; then
          echo "Missing child contact component capture: $stem$suffix" >&2
          return 1
        fi
      done
    done
    adb pull /sdcard/Download/sgm-team-history "$output_dir" || return 1
    for name in team-history-paging.png team-history-paging-window.png team-history-redacted-child.png team-history-redacted-child-window.png; do
      if [[ ! -s "$output_dir/sgm-team-history/$name" ]]; then
        echo "Missing team history component capture: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-team-enrollment "$output_dir" || return 1
    for name in team-requested.png team-requested-window.png team-approved-narrow.png team-approved-narrow-window.png; do
      if [[ ! -s "$output_dir/sgm-team-enrollment/$name" ]]; then
        echo "Missing team enrollment component capture: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-emergency-contact "$output_dir" || return 1
    for name in emergency-editor-narrow.png emergency-editor-narrow-window.png emergency-editor-changed.png emergency-editor-changed-window.png; do
      if [[ ! -s "$output_dir/sgm-emergency-contact/$name" ]]; then
        echo "Missing emergency contact component capture: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-payment-confirmation "$output_dir" || return 1
    for name in payment-pending-narrow.png payment-pending-narrow-window.png payment-review.png payment-review-window.png; do
      if [[ ! -s "$output_dir/sgm-payment-confirmation/$name" ]]; then
        echo "Missing payment confirmation component capture: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-session-restoration "$output_dir" || return 1
    for name in session-restoration-error.png session-restoration-narrow.png; do
      if [[ ! -s "$output_dir/sgm-session-restoration/$name" ]]; then
        echo "Missing session restoration screen: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-booking-review "$output_dir" || return 1
    for name in booking-review-required.png booking-review-narrow.png; do
      if [[ ! -s "$output_dir/sgm-booking-review/$name" ]]; then
        echo "Missing booking review screen: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-booking-feedback "$output_dir" || return 1
    for name in booking-feedback-sending-narrow.png booking-feedback-confirmed-narrow.png booking-feedback-width-probe.json; do
      if [[ ! -s "$output_dir/sgm-booking-feedback/$name" ]]; then
        echo "Missing booking feedback screen: $name" >&2
        return 1
      fi
    done
    adb pull /sdcard/Download/sgm-trip-changes "$output_dir" || return 1
    for name in trip-change-driver-proposed.png trip-change-parent-review-large-text.png trip-change-parent-accepted.png trip-change-parent-declined.png trip-change-applied-balance-due.png trip-draft-restored-large-text.png; do
      if [[ ! -s "$output_dir/sgm-trip-changes/$name" ]]; then
        echo "Missing trip change screen: $name" >&2
        return 1
      fi
      window_name="${name%.png}-window.png"
      if [[ ! -s "$output_dir/sgm-trip-changes/$window_name" ]]; then
        echo "Missing native trip change display capture: $window_name" >&2
        return 1
      fi
    done
    screenshot_count="$(find "$output_dir" -type f -name "store-*.png" -size +0c | wc -l | tr -d " ")"
    if [[ "$screenshot_count" -lt 8 ]]; then
      echo "Expected at least 8 non-empty Android store-review screenshots, found $screenshot_count." >&2
      return 1
    fi
  fi
}

capture_status=0
collect_component_evidence || capture_status=$?
if [[ "$capture_status" -ne 0 ]]; then
  if ! node "$repo_root/scripts/qa/adb-host-health.mjs" component-transfer "$output_dir/adb-host-component-transfer.json"; then
    echo "::warning::Host transport observation unavailable; original component failure is preserved"
  fi
fi
replay_status=0
node "$repo_root/scripts/qa/run-local-android-flows.mjs" || replay_status=$?
if [[ "$replay_status" -ne 0 ]]; then
  if ! node "$repo_root/scripts/qa/adb-host-health.mjs" local-replay "$output_dir/adb-host-local-replay.json"; then
    echo "::warning::Host transport observation unavailable; original replay failure is preserved"
  fi
fi

printf 'Ordinary tests: %s; component evidence: %s; local replay: %s\n' "$test_status" "$capture_status" "$replay_status"
printf '{"scope":"native-suite-exit-status-not-flow-verification","ordinaryTests":%s,"componentEvidence":%s,"localReplay":%s}\n' \
  "$test_status" "$capture_status" "$replay_status" > "$output_dir/native-suite-status.json"
if [[ "$test_status" -ne 0 ]]; then exit "$test_status"; fi
if [[ "$capture_status" -ne 0 ]]; then exit "$capture_status"; fi
exit "$replay_status"
