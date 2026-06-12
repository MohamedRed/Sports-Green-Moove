package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot

data class ActiveRideStartResult(
    val ride: LiveRideSnapshot,
    val notice: String,
)

suspend fun AndroidProviderSet.startTrackedRide(
    tripId: String,
    role: AppRole,
): ActiveRideStartResult {
    val ride = firebase.startRide(tripId)
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
