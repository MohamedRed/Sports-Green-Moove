package be.sportgreenmoove.app.services

import android.location.Location
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.domain.NativeLocationBatchUpdate

internal fun AppRole.locationRole(): String =
    if (this == AppRole.Child) "child" else "driver"

internal fun nativeLocationPayload(rideSessionId: String, role: String, location: Location): Map<String, Any> {
    return NativeLocationBatchUpdate(
        rideSessionId = rideSessionId,
        role = role,
        latitude = location.latitude,
        longitude = location.longitude,
        accuracyM = location.accuracy.toDouble(),
        capturedAtMs = location.time,
        speedMps = location.speed.takeIf { location.hasSpeed() }?.toDouble(),
        headingDeg = location.bearing.takeIf { location.hasBearing() }?.toDouble(),
    ).toCallablePayload()
}
