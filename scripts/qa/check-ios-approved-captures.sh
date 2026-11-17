#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sgm-approved-captures.XXXXXX")
trap 'rm -rf "$BUILD_DIR"' EXIT
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors \
  "$ROOT_DIR/scripts/qa/ios-approved-captures/Policy.swift" \
  "$ROOT_DIR/scripts/qa/ios-approved-captures/SelfTests.swift" \
  "$ROOT_DIR/scripts/qa/ios-approved-captures/main.swift" \
  -o "$BUILD_DIR/check"
"$BUILD_DIR/check" "$@"
