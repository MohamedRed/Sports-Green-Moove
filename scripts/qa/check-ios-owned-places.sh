#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT_DIR/ios/Sources/SportsGreenMooveApp"
TEST="$ROOT_DIR/tests/fixtures/ios-search-callable"
BUILD=$(mktemp -d "${TMPDIR:-/tmp}/sgm-owned-places.XXXXXX")
trap 'rm -rf "$BUILD"' EXIT
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -emit-module -emit-library \
  -module-name FirebaseAuth "$ROOT_DIR/tests/fixtures/ios-ride-chat-runtime/FirebaseAuth.swift" \
  -emit-module-path "$BUILD/FirebaseAuth.swiftmodule" -o "$BUILD/libFirebaseAuth.dylib"
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -emit-module -emit-library \
  -module-name FirebaseFunctions "$TEST/FirebaseFunctions.swift" \
  -emit-module-path "$BUILD/FirebaseFunctions.swiftmodule" -o "$BUILD/libFirebaseFunctions.dylib"
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -I "$BUILD" -L "$BUILD" \
  -lFirebaseAuth -lFirebaseFunctions "$TEST/main.swift" \
  "$APP/Models.swift" "$APP/ClubSummary.swift" "$APP/BookingIntentSnapshot.swift" \
  "$APP/PendingReviews.swift" "$APP/ReviewTripContext.swift" \
  "$APP/ProviderConfigurationError.swift" \
  "$APP/TeamChatModels.swift" "$APP/TeamChatText.swift" "$APP/TeamChatWire.swift" \
  "$APP/PendingBookingStore.swift" "$APP/BookingRequestCoordinator.swift" "$APP/FirebaseBookingRequests.swift" \
  "$APP/FirebaseOwnedBookingGateway.swift" \
  "$APP/PlaceSearchWire.swift" "$APP/FirebaseCallableBoundary.swift" "$APP/FirebasePlacesGateway.swift" -o "$BUILD/check"
DYLD_LIBRARY_PATH="$BUILD" "$BUILD/check"

swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -I "$BUILD" -L "$BUILD" \
  -lFirebaseAuth -lFirebaseFunctions "$ROOT_DIR/tests/fixtures/ios-parent-reservations/main.swift" \
  "$APP/ProviderConfigurationError.swift" \
  "$APP/Models.swift" "$APP/ClubSummary.swift" "$APP/BookingIntentSnapshot.swift" \
  "$APP/PendingReviews.swift" "$APP/ReviewTripContext.swift" \
  "$APP/AuthSession.swift" "$APP/AccountWorkScope.swift" "$APP/ClubMembership.swift" "$APP/MembershipWire.swift" \
  "$APP/ParentReservation.swift" "$APP/ParentReservationWire.swift" \
  "$APP/FirebaseCallableBoundary.swift" "$APP/FirebaseParentReservations.swift" -o "$BUILD/parent-reservations"
DYLD_LIBRARY_PATH="$BUILD" "$BUILD/parent-reservations"
