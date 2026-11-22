#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT_DIR/ios/Sources/SportsGreenMooveApp"
TEST="$ROOT_DIR/tests/fixtures/ios-membership-fixture"
BUILD=$(mktemp -d "${TMPDIR:-/tmp}/sgm-membership-fixture.XXXXXX")
trap 'rm -rf "$BUILD"' EXIT
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -D DEBUG \
  "$TEST/Context.swift" "$TEST/main.swift" \
  "$APP/Models.swift" "$APP/BookingIntentSnapshot.swift" "$APP/ClubSummary.swift" "$APP/AuthSession.swift" \
  "$APP/PendingReviews.swift" "$APP/ReviewTripContext.swift" \
  "$APP/ProviderConfigurationError.swift" \
  "$APP/ClubMembership.swift" "$APP/MembershipWire.swift" "$APP/MembershipPolicy.swift" \
  "$APP/AccountWorkScope.swift" "$APP/MembershipPager.swift" "$APP/MembershipReviewState.swift" \
  "$APP/UITestMembershipGateway.swift" -o "$BUILD/check"
"$BUILD/check" approve
"$BUILD/check" reject
