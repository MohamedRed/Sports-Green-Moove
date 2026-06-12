package be.sportgreenmoove.app.services

import android.location.Location
import be.sportgreenmoove.app.data.AppRole

internal fun AppRole.locationRole(): String =
    if (this == AppRole.Child) "child" else "driver"

internal fun nativeLocationPayload(rideSessionId: String, role: String, location: Location): Map<String, Any> {
    val data = mutableMapOf<String, Any>(
        "rideSessionId" to rideSessionId,
        "role" to role,
        "lat" to location.latitude,
        "lng" to location.longitude,
        "accuracyM" to location.accuracy.coerceAtLeast(0f).toDouble(),
        "capturedAt" to location.time,
    )
    if (location.hasSpeed()) data["speedMps"] = location.speed.toDouble()
    if (location.hasBearing()) data["headingDeg"] = location.bearing.toDouble()
    return data
}
