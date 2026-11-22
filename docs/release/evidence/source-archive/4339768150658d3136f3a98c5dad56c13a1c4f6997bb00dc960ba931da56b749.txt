#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/sports-green-moove-ios-native-checks"
mkdir -p "${BUILD_DIR}"

swiftc \
  -swift-version 6 \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ImpactRewardSummaries.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/LedgerSummaryWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/GatewayContracts.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/StripePaymentsGateway.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PaymentScreenController.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ProviderConfigurationError.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/LocationSessionState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/RideRequestState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AccountWorkScope.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppDataGateway.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportSubmission.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportSubmissionState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportModels.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SupportInboxState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/RidePaymentVerification.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+RidePayments.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/NativePaymentSheetFlow.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/StripePaymentSheetPresenter.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ClubSummary.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/Models.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AuthSession.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SearchFormState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/SearchRequestState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+Bookings.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/LogoutIntentStore.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AuthenticationState.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+Authentication.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+LocationShutdown.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+Profile.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+Data.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppState+Search.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/UnconfiguredGateways.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ActiveRidePermissionGate.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ActiveRideStartup.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/AppStateRideLifecycle.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ReviewTripContext.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/ReviewTripContextWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PendingReviews.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PendingReviewWire.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/BookingIntentSnapshot.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/StripeConnectModels.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/TripPublishDraft.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/PublishController.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/NativePlanPolicies.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/MapRoutePolyline.swift" \
  "${ROOT_DIR}/ios/Sources/SportsGreenMooveApp/TripDateLabels.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/TripDateLabelChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SearchConsentChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SearchAppStateChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/AppDataProbe.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/AuthenticationProbe.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/LocationSessionChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/LocationShutdownChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RideLifecycleProbe.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RideLifecycleChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RideBoundaryChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/PublishOwnershipChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/AccountWorkChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/PublishBoundaryChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/ProfileInitializationProbe.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/ProfileInitializationChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/AuthenticationChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/LogoutIntentChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/AppDataRefreshChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RidePaymentChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/RidePaymentOwnershipChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/PaymentScreenChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/BookingOwnershipChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/LedgerSummaryChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportStateChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/SupportSubmissionChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/PendingReviewChecks.swift" \
  "${ROOT_DIR}/ios/Tests/SportsGreenMooveNativeChecks/main.swift" \
  -o "${BUILD_DIR}/SportsGreenMooveNativeChecks"

"${BUILD_DIR}/SportsGreenMooveNativeChecks"
