package be.sportgreenmoove.app.services

import android.location.Location
import android.os.SystemClock
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.domain.NativeLocationBatchUpdate

internal fun AppRole.locationRole(): String =
    if (this == AppRole.Child) "child" else "driver"

internal fun nativeLocationPayload(rideSessionId: String, role: String, location: Location, clock: NativeCaptureClock): Map<String, Any> {
    val capturedAt = try {
        clock.capturedAt(location.elapsedRealtimeNanos, SystemClock.elapsedRealtimeNanos())
    } catch (_: IllegalArgumentException) {
        throw ProviderConfigurationException("Position GPS non confirmée. Réessayez.")
    }
    return NativeLocationBatchUpdate(
        rideSessionId = rideSessionId,
        role = role,
        latitude = location.latitude,
        longitude = location.longitude,
        accuracyM = location.accuracy.toDouble(),
        capturedAtMs = capturedAt,
        speedMps = location.speed.takeIf { location.hasSpeed() }?.toDouble(),
        headingDeg = location.bearing.takeIf { location.hasBearing() }?.toDouble(),
    ).toCallablePayload() + mapOf("deviceCapturedAt" to location.time, "captureClock" to "serverElapsedRealtime")
}
