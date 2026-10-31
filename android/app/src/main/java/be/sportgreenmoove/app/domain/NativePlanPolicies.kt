package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.TripStatus
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

data class ActiveRidePermissionSnapshot(
    val hasForegroundLocation: Boolean,
    val hasBackgroundLocation: Boolean,
    val hasNotifications: Boolean,
)

enum class ActiveRidePermissionRequirement {
    ForegroundLocation,
    BackgroundLocation,
    Notifications,
}

object ActiveRidePermissionPolicy {
    fun missingRequirements(snapshot: ActiveRidePermissionSnapshot): List<ActiveRidePermissionRequirement> = buildList {
        if (!snapshot.hasForegroundLocation) add(ActiveRidePermissionRequirement.ForegroundLocation)
        if (!snapshot.hasBackgroundLocation) add(ActiveRidePermissionRequirement.BackgroundLocation)
        if (!snapshot.hasNotifications) add(ActiveRidePermissionRequirement.Notifications)
    }

    fun canStartActiveRide(snapshot: ActiveRidePermissionSnapshot): Boolean =
        missingRequirements(snapshot).isEmpty()
}

object TripStatePolicy {
    fun statusFor(nowEpochMillis: Long, departureEpochMillis: Long?): TripStatus =
        if (departureEpochMillis != null && departureEpochMillis < nowEpochMillis) TripStatus.Past else TripStatus.Upcoming
}

data class NativeMatchCandidateSignal(
    val detourSeconds: Int,
    val detourMeters: Int,
    val pickupMeters: Int,
    val scheduleDeltaMinutes: Int,
    val sameClub: Boolean,
    val sameTeam: Boolean,
    val seatsAvailable: Int,
    val seatsNeeded: Int,
    val supportsVehicleTracking: Boolean,
    val supportsChildTracking: Boolean,
    val driverRating: Double,
    val co2SavedKgEstimate: Double,
    val priceCents: Int,
    val maxDetourMinutes: Int? = null,
    val maxPickupDistanceMeters: Int? = null,
)

object NativeMatchingScore {
    fun score(signal: NativeMatchCandidateSignal): Double {
        var score = 100.0
        val detourMinutes = signal.detourSeconds / 60.0
        score -= detourMinutes * 2.25
        score -= (signal.detourMeters / 1000.0) * 1.1
        score -= (signal.pickupMeters / 1000.0) * 5
        score -= abs(signal.scheduleDeltaMinutes) * 1.4

        if (signal.sameClub) score += 14
        if (signal.sameTeam) score += 18
        if (signal.seatsAvailable > signal.seatsNeeded) score += min(8, signal.seatsAvailable * 2)
        if (signal.supportsVehicleTracking) score += 6
        if (signal.supportsChildTracking) score += 8

        score += max(0.0, signal.driverRating - 3.0) * 5
        score += min(8.0, signal.co2SavedKgEstimate)
        score -= min(10.0, signal.priceCents / 100.0)

        if (signal.maxDetourMinutes != null && detourMinutes > signal.maxDetourMinutes) score -= 80
        if (signal.maxPickupDistanceMeters != null && signal.pickupMeters > signal.maxPickupDistanceMeters) score -= 80
        return round(score * 100) / 100
    }
}

data class NativeRewardLedgerEntry(
    val userId: String,
    val amountCents: Int,
)

object NativeImpactLedger {
    private const val GRAMS_PER_KM_BY_CAR = 171
    private const val SHARED_RIDE_CREDIT_RATIO = 0.78

    fun estimateCo2SavedKg(distanceMeters: Int, passengersSharing: Int): Double {
        if (distanceMeters <= 0 || passengersSharing <= 0) return 0.0
        val avoidedSoloTrips = max(0, passengersSharing - 1)
        val grams = (distanceMeters / 1000.0) * GRAMS_PER_KM_BY_CAR * avoidedSoloTrips * SHARED_RIDE_CREDIT_RATIO
        return round((grams / 1000.0) * 100) / 100
    }

    fun rewardForCo2Saved(co2SavedKg: Double): Int =
        if (co2SavedKg <= 0) 0 else round(co2SavedKg * 12).toInt()

    fun rewardBalanceCents(entries: List<NativeRewardLedgerEntry>, userId: String): Int =
        entries.filter { it.userId == userId }.sumOf { it.amountCents }
}

data class NativeLocationBatchUpdate(
    val rideSessionId: String,
    val role: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    val capturedAtMs: Long,
    val speedMps: Double? = null,
    val headingDeg: Double? = null,
) {
    fun toCallablePayload(): Map<String, Any> {
        val payload = mutableMapOf<String, Any>(
            "rideSessionId" to rideSessionId,
            "role" to role,
            "lat" to latitude,
            "lng" to longitude,
            "accuracyM" to accuracyM.coerceAtLeast(0.0),
            "capturedAt" to capturedAtMs,
        )
        if (speedMps != null) payload["speedMps"] = speedMps
        if (headingDeg != null) payload["headingDeg"] = headingDeg
        return payload
    }
}
