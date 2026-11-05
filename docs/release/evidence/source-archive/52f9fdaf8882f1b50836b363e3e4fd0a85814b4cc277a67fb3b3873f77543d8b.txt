#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$ROOT_DIR/tests/fixtures/ios-support-concurrency"
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sgm-support-concurrency.XXXXXX")
trap 'rm -rf "$BUILD_DIR"' EXIT

for module in FirebaseCore FirebaseFirestore FirebaseAuth FirebaseFunctions; do
  source="$FIXTURES/$module.swift"
  case "$module" in FirebaseCore) source="$FIXTURES/Empty.swift" ;; esac
  swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors \
    -emit-module -module-name "$module" "$source" -emit-module-path "$BUILD_DIR/$module.swiftmodule"
done

swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -D DEBUG -I "$BUILD_DIR" -typecheck \
  "$FIXTURES/GatewayContext.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/Models.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ProfileCity.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseProfileCityGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/UITestProfileCityGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ClubSummary.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ClubMembership.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/MembershipWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/MembershipRequest.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseMembershipDirectory.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseMembershipGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseClubSummaries.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/UITestMembershipGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/ReceivedRatings.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseReceivedRatingsGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/TeamChatModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/TeamChatWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/TeamChatRequest.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatIdentity.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatDirectoryWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatMessageWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatSourcePolicy.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatRequest.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RideChatCallbackClock.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseRideChatSnapshots.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseRideChatThreadWatch.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseRideChatInboxWatch.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseRideChatGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/UITestRideChatWatches.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/UITestRideChat.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseTeamChatGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/UITestTeamChat.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/StripeConnectModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/StripePaymentsGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/RidePaymentVerification.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseStripePaymentsGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/AuthSession.swift" \
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
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/EmergencyContactModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/EmergencyContactRequest.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/GuardianContactModels.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/EmergencyContactWire.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseEmergencyContactGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/NativePlanPolicies.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseLocationUpload.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseInitializedProfile.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseSupportGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseInboxGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/SupportSubmission.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseFeedbackGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseSearchGateway.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseMapMappers.swift" \
  "$ROOT_DIR/ios/Sources/SportsGreenMooveApp/FirebaseBookingRequests.swift"
printf '%s\n' 'Owned callable signature checks passed; this is not an SDK build or phone test.'
