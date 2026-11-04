#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$ROOT_DIR/tests/fixtures/ios-support-concurrency"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sgm-support-concurrency.XXXXXX")
trap 'rm -rf "$BUILD_DIR"' EXIT

for module in FirebaseCore FirebaseFirestore FirebaseAuth FirebaseFunctions; do
  source="$FIXTURES/$module.swift"
  case "$module" in FirebaseCore|FirebaseFirestore) source="$FIXTURES/Empty.swift" ;; esac
  swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors \
    -emit-module -module-name "$module" "$source" -emit-module-path "$BUILD_DIR/$module.swiftmodule"
done

swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -I "$BUILD_DIR" -typecheck \
  "$FIXTURES/GatewayContext.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/SupportModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/SupportWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseSupportGateway.swift"
printf '%s\n' 'Support concurrency signature checks passed; this is not an SDK build or phone test.'
