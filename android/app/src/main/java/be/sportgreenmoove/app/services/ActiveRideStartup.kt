package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.RideCompletionSummary

data class ActiveRideStartResult(
    val ride: LiveRideSnapshot,
    val notice: String,
)

suspend fun AndroidProviderSet.startTrackedRide(
    tripId: String,
    role: AppRole,
    bookingIds: List<String>,
): ActiveRideStartResult {
    val ride = firebase.startRide(tripId, bookingIds)
    return startTrackingForRide(ride, role)
}

suspend fun AndroidProviderSet.startAccessibleRideTracking(
    role: AppRole,
): ActiveRideStartResult {
    val ride = firebase.getActiveRide()
        ?: throw ProviderConfigurationException("Aucune course active accessible pour démarrer le suivi.")
    return startTrackingForRide(ride, role)
}

private suspend fun AndroidProviderSet.startTrackingForRide(
    ride: LiveRideSnapshot,
    role: AppRole,
): ActiveRideStartResult {
    val radarStarted = if (radar.isConfigured) {
        runCatching {
            radar.startTripTracking(ride.rideSessionId, role)
        }.isSuccess
    } else {
        false
    }

    firebase.writeNativeLocationFallback(ride.rideSessionId, role)

    val notice = if (radarStarted) {
        "Suivi Radar et secours GPS Firebase activés."
    } else {
        "Secours GPS Firebase activé."
    }
    return ActiveRideStartResult(ride = ride, notice = notice)
}

suspend fun AndroidProviderSet.endTrackedRide(
    rideSessionId: String,
    distanceMeters: Int,
    passengersSharing: Int,
): RideCompletionSummary {
    val completion = firebase.endRide(
        rideSessionId = rideSessionId,
        distanceMeters = distanceMeters,
        passengersSharing = passengersSharing,
    )
    firebase.stopNativeLocationFallback(rideSessionId)
    if (radar.isConfigured) {
        runCatching { radar.stopTripTracking(rideSessionId) }
    }
    return completion
}
