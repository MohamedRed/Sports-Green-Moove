#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/sports-green-moove-ios-native-checks"
mkdir -p "${BUILD_DIR}"

swiftc \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/GatewayContracts.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ClubSummary.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/Models.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/StripeConnectModels.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/TripPublishDraft.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/NativePlanPolicies.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/MapRoutePolyline.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/main.swift" \
  -o "${BUILD_DIR}/SportsGreenMooveNativeChecks"

"${BUILD_DIR}/SportsGreenMooveNativeChecks"
