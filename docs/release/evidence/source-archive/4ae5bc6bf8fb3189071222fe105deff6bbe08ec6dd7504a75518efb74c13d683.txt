package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripPublishDraft

internal fun TripPublishDraft.toCallablePayload(): Map<String, Any> {
    val payload = mutableMapOf<String, Any>(
        "title" to title,
        "sport" to sport,
        "clubName" to clubName,
        "teamName" to teamName,
        "clubId" to clubId,
        "teamId" to teamId,
        "category" to category,
        "departureAt" to departureAtIso,
        "origin" to mapOf("lat" to origin.lat, "lng" to origin.lng),
        "destination" to mapOf("lat" to destination.lat, "lng" to destination.lng),
        "pickupRadiusM" to pickupRadiusM,
        "seatsTotal" to seatsTotal,
        "seatsAvailable" to seatsAvailable,
        "baggage" to baggage,
        "returnTrip" to returnTrip,
        "priceCents" to priceCents,
        "supportsVehicleTracking" to supportsVehicleTracking,
        "supportsChildTracking" to supportsChildTracking,
        "co2SavedKgEstimate" to co2SavedKgEstimate,
    )
    distanceKm?.let { payload["distanceKm"] = it }
    return payload
}
