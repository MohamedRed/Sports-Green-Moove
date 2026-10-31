package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class RideObservationWireTest {
    private val valid = mapOf("vehicleAgeMs" to 30_000L, "childAgeMs" to null,
        "vehicleHasPoint" to true, "childHasPoint" to false, "vehicleSource" to "nativeFallback", "childSource" to null)
    @Test fun readsStructuredServerAgesWithoutReadingThePhoneClock() {
        val result = mapRideObservation(valid)!!
        assertEquals(30_000L, result.vehicleAgeMs); assertNull(result.childAgeMs)
        assertTrue(result.vehicleHasPoint); assertFalse(result.childHasPoint)
    }
    @Test fun invalidAgesAndUnknownSourcesAreNotGuessed() {
        for (age in listOf(-1, 1.5, Double.NaN, Double.POSITIVE_INFINITY, "now"))
            assertTrue(runCatching { mapRideObservation(valid + ("vehicleAgeMs" to age)) }.isFailure)
        assertTrue(runCatching { mapRideObservation(valid + ("vehicleSource" to "unknown")) }.isFailure)
        assertTrue(runCatching { mapRideObservation(valid - "vehicleAgeMs") }.isFailure)
    }
    @Test fun anAbsentProtocolRemainsExplicitlyAbsentForTheObserverToRefuse() {
        assertNull(mapRideObservation(null))
    }
}
