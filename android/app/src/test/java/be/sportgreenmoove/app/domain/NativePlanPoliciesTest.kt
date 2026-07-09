package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.TripStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativePlanPoliciesTest {
    @Test
    fun tripStateUsesDepartureTimeOnly() {
        val now = 1_700_000_000_000L

        assertEquals(TripStatus.Past, TripStatePolicy.statusFor(now, now - 1))
        assertEquals(TripStatus.Upcoming, TripStatePolicy.statusFor(now, now))
        assertEquals(TripStatus.Upcoming, TripStatePolicy.statusFor(now, null))
    }

    @Test
    fun activeRideRequiresAllRuntimePermissions() {
        val missing = ActiveRidePermissionPolicy.missingRequirements(
            ActiveRidePermissionSnapshot(
                hasForegroundLocation = true,
                hasBackgroundLocation = false,
                hasNotifications = false,
            ),
        )

        assertEquals(
            listOf(
                ActiveRidePermissionRequirement.BackgroundLocation,
                ActiveRidePermissionRequirement.Notifications,
            ),
            missing,
        )
        assertFalse(
            ActiveRidePermissionPolicy.canStartActiveRide(
                ActiveRidePermissionSnapshot(
                    hasForegroundLocation = true,
                    hasBackgroundLocation = false,
                    hasNotifications = true,
                ),
            ),
        )
        assertTrue(
            ActiveRidePermissionPolicy.canStartActiveRide(
                ActiveRidePermissionSnapshot(
                    hasForegroundLocation = true,
                    hasBackgroundLocation = true,
                    hasNotifications = true,
                ),
            ),
        )
    }

    @Test
    fun matchingScoreRewardsTrackedSameTeamRides() {
        val score = NativeMatchingScore.score(
            NativeMatchCandidateSignal(
                detourSeconds = 360,
                detourMeters = 2_000,
                pickupMeters = 800,
                scheduleDeltaMinutes = 4,
                sameClub = true,
                sameTeam = true,
                seatsAvailable = 3,
                seatsNeeded = 1,
                supportsVehicleTracking = true,
                supportsChildTracking = true,
                driverRating = 4.6,
                co2SavedKgEstimate = 3.4,
                priceCents = 250,
            ),
        )

        assertEquals(135.6, score, 0.001)
    }

    @Test
    fun matchingScoreAppliesExplicitDetourAndPickupCaps() {
        val score = NativeMatchingScore.score(
            NativeMatchCandidateSignal(
                detourSeconds = 1_800,
                detourMeters = 15_000,
                pickupMeters = 6_000,
                scheduleDeltaMinutes = 18,
                sameClub = false,
                sameTeam = false,
                seatsAvailable = 1,
                seatsNeeded = 1,
                supportsVehicleTracking = false,
                supportsChildTracking = false,
                driverRating = 3.0,
                co2SavedKgEstimate = 0.0,
                priceCents = 1_400,
                maxDetourMinutes = 10,
                maxPickupDistanceMeters = 2_000,
            ),
        )

        assertTrue(score < -100.0)
    }

    @Test
    fun co2RewardsAndLedgerMathMatchBackendContract() {
        val co2Saved = NativeImpactLedger.estimateCo2SavedKg(distanceMeters = 12_000, passengersSharing = 3)
        val balance = NativeImpactLedger.rewardBalanceCents(
            listOf(
                NativeRewardLedgerEntry(userId = "driver-1", amountCents = 38),
                NativeRewardLedgerEntry(userId = "driver-2", amountCents = 12),
                NativeRewardLedgerEntry(userId = "driver-1", amountCents = -5),
            ),
            userId = "driver-1",
        )

        assertEquals(3.2, co2Saved, 0.001)
        assertEquals(38, NativeImpactLedger.rewardForCo2Saved(co2Saved))
        assertEquals(33, balance)
    }

    @Test
    fun locationBatchPayloadUsesCloudFunctionContract() {
        val payload = NativeLocationBatchUpdate(
            rideSessionId = "ride-1",
            role = "child",
            latitude = 50.8466,
            longitude = 4.3528,
            accuracyM = -1.0,
            capturedAtMs = 1_700_000_000_123,
            speedMps = 2.5,
            headingDeg = null,
        ).toCallablePayload()

        assertEquals("ride-1", payload["rideSessionId"])
        assertEquals("child", payload["role"])
        assertEquals(50.8466, payload["lat"])
        assertEquals(4.3528, payload["lng"])
        assertEquals(0.0, payload["accuracyM"])
        assertEquals(1_700_000_000_123, payload["capturedAt"])
        assertEquals(2.5, payload["speedMps"])
        assertFalse(payload.containsKey("headingDeg"))
    }
}
