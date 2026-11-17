package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.RideObservation
import org.junit.Assert.*
import org.junit.Test

class RideObservationAgeTest {
    @Test fun unknownAndMissingPointsAreDistinctAndNeverFresh() {
        val absent = ageRideObservation(ride().copy(observation = timing(null, false)), 20_000)
        assertTrue(absent.stale); assertEquals("En attente du premier point GPS", absent.vehicleLastUpdateLabel)
        val unknown = ageRideObservation(ride().copy(observation = timing(null, true)), 20_000)
        assertTrue(unknown.stale); assertEquals("Position à vérifier", unknown.vehicleLastUpdateLabel)
    }
    @Test fun childAgeContinuesWithoutInventingAChildDevice() {
        assertNull(ageRideObservation(ride(), 10_000).childLastUpdateLabel)
        val child = ride().copy(observation = timing(0).copy(childAgeMs = 65_000, childHasPoint = true, childSource = "radar"))
        assertEquals("GPS · il y a 2 min", ageRideObservation(child, 55_000).childLastUpdateLabel)
    }
    @Test fun elapsedOverflowCannotMakeAnOldPositionFresh() {
        val result = ageRideObservation(ride().copy(observation = timing(Long.MAX_VALUE - 1)), 100)
        assertTrue(result.stale); assertFalse(result.vehicleLastUpdateLabel.contains("instant"))
    }
    @Test fun missingProtocolAndBackwardsMonotonicClockAreRejected() {
        assertTrue(runCatching { ageRideObservation(ride().copy(observation = null), 1) }.isFailure)
        assertTrue(runCatching { ageRideObservation(ride(), -1) }.isFailure)
    }
    private fun timing(age: Long?, hasPoint: Boolean = true) = RideObservation(age, null, hasPoint, false, "nativeFallback", null)
    private fun ride() = LiveRideSnapshot("qa-ride", status = "Actif", vehicleLastUpdateLabel = "old label", childLastUpdateLabel = null,
        etaLabel = "ETA à calculer", stale = false, observation = timing(0))
}
