package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class VehicleMapPointWireTest {
    private val point = mapOf("lat" to 50.716, "lng" to 4.612, "capturedAt" to 1_760_000_000_000L, "source" to "nativeFallback")
    @Test fun parsesTheServerPointWithoutSubstitutingTheRouteOrPhoneTime() {
        val value = requireNotNull(mapVehicleMapPoint(point))
        assertEquals(50.716, value.lat, 0.0); assertEquals(4.612, value.lng, 0.0)
        assertEquals(1_760_000_000_000L, value.capturedAt); assertEquals("nativeFallback", value.source)
    }
    @Test fun absentCoordinatesNeverBecomeAnOriginMarker() { assertNull(mapVehicleMapPoint(null)) }
    @Test fun malformedCoordinatesTimesAndSourcesAreNotSilentlyReplaced() {
        for (patch in listOf(mapOf("lat" to 91), mapOf("lng" to Double.NaN), mapOf("capturedAt" to 1.5),
            mapOf("capturedAt" to Long.MAX_VALUE), mapOf("capturedAt" to 0), mapOf("source" to "unknown"), mapOf("lat" to "50")))
            assertTrue(runCatching { mapVehicleMapPoint(point + patch) }.isFailure)
        assertTrue(runCatching { mapVehicleMapPoint(point - "lat") }.isFailure)
        assertTrue(runCatching { mapVehicleMapPoint("point") }.isFailure)
    }
    @Test fun newCoordinatesAndTheCaptureIdentityAreBothReplaced() {
        val first = requireNotNull(mapVehicleMapPoint(point))
        val next = requireNotNull(mapVehicleMapPoint(point + mapOf("lat" to 50.717, "capturedAt" to first.capturedAt + 1)))
        assertNotEquals(first, next); assertEquals(first.capturedAt + 1, next.capturedAt)
    }
}
