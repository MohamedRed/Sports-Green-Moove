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
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/Models.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/BookingIntentSnapshot.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/PendingBookingStore.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/BookingRequestCoordinator.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ImpactRewardSummaries.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/LedgerSummaryWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/PendingReviews.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/PendingReviewWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ReviewTripContext.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ReviewTripContextWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/TripDateLabels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/SupportModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/SupportWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseCallableBoundary.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseSupportGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseInboxGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseSearchGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseMapMappers.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseBookingRequests.swift"
printf '%s\n' 'Owned callable signature checks passed; this is not an SDK build or phone test.'
