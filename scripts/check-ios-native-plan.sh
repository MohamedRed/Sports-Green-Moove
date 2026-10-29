#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/sports-green-moove-ios-native-checks"
mkdir -p "${BUILD_DIR}"

swiftc \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ImpactRewardSummaries.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/LedgerSummaryWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/GatewayContracts.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportSubmission.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportSubmissionState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportModels.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportInboxState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/RidePaymentVerification.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ClubSummary.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/Models.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PendingReviews.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PendingReviewWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/BookingIntentSnapshot.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/StripeConnectModels.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/TripPublishDraft.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/NativePlanPolicies.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/MapRoutePolyline.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/TripDateLabels.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/TripDateLabelChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RidePaymentChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/LedgerSummaryChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportStateChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportSubmissionChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/PendingReviewChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/main.swift" \
  -o "${BUILD_DIR}/SportsGreenMooveNativeChecks"

"${BUILD_DIR}/SportsGreenMooveNativeChecks"
