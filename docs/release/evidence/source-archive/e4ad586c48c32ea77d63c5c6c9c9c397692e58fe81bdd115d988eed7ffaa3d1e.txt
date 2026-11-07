#!/usr/bin/env bash
set -u
case "${1:-}" in
  emergency-identity|ride-observation|native-startup|remote-ride-stop|session-restoration|session-disconnect|team-conversation|team-access|team-draft|team-read-components|chat-network-recovery) phase="$1" ;;
  *) printf 'Select one focused case on its own fresh disposable phone.\n' >&2; exit 2 ;;
esac
export SGM_FOCUSED_UI_CASE="$phase"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$repo_root/android/app/build/outputs/focused-safety-ui/$phase"
mkdir -p "$output_dir" || exit 1
if [[ "$phase" == chat-network-recovery ]]; then
  node "$repo_root/scripts/qa/observe-network-bootstrap.mjs" "$output_dir/network-bootstrap" || exit 1
fi
device_receipt="$output_dir/disposable-device-setup.json"
node "$repo_root/scripts/qa/configure-continuous-disposable.mjs" > "$device_receipt" || exit 1
restore_test_device() {
  suite_status=$?
  restore_status=0
  node "$repo_root/scripts/qa/restore-continuous-disposable.mjs" "$device_receipt" > "$output_dir/disposable-device-restore.json" || restore_status=$?
  if [[ "$restore_status" -eq 0 && "${GITHUB_ACTIONS:-false}" == true && "${RUNNER_OS:-}" == Linux ]]; then
    node "$repo_root/scripts/qa/observe-emulator-shutdown.mjs" start "$phase" || printf '::warning::Read-only CI host observation unavailable; original outcomes unchanged.\n'
  fi
  if [[ "$suite_status" -ne 0 ]]; then exit "$suite_status"; fi
  exit "$restore_status"
}
trap restore_test_device EXIT
export SGM_PREINSTALLED_TEST_APKS_RECEIPT="$device_receipt"
flow_status=0
node "$repo_root/scripts/qa/run-local-$phase-ui.mjs" || flow_status=$?
printf '{"scope":"%s-command-status-not-flow-verification","status":%s}\n' \
  "$phase" "$flow_status" > "$output_dir/$phase-suite-status.json"
exit "$flow_status"
