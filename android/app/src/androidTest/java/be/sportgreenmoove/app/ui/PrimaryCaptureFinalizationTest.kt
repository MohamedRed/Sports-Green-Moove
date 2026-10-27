package be.sportgreenmoove.app.ui

import org.junit.Assert.*
import org.junit.Test

class PrimaryCaptureFinalizationTest {
    @Test fun stoppedObservationPersistsItsVerifiedTerminationOnce() {
        var waits = 0; val saved = mutableListOf<Boolean>()
        finishPrimaryCaptureObservation({ waits++; true }, saved::add)
        assertEquals(1, waits); assertEquals(listOf(true), saved)
    }
    @Test fun timedOutObservationStillPersistsItsFinalUnverifiedState() {
        var waits = 0; val saved = mutableListOf<Boolean>()
        val failure = assertThrows(IllegalStateException::class.java) {
            finishPrimaryCaptureObservation({ waits++; false }, saved::add)
        }
        assertEquals("Capture observer did not stop", failure.message)
        assertEquals(1, waits); assertEquals(listOf(false), saved)
    }
    @Test fun terminationExceptionIsPreservedAfterPersistingItsUnverifiedState() {
        val expected = InterruptedException("Synthetic observer interruption"); val saved = mutableListOf<Boolean>()
        val failure = assertThrows(InterruptedException::class.java) {
            finishPrimaryCaptureObservation({ throw expected }, saved::add)
        }
        assertSame(expected, failure); assertEquals(listOf(false), saved)
    }
    @Test fun persistenceFailureDoesNotHideATerminationFailure() {
        val original = IllegalStateException("Synthetic termination error")
        val persistence = IllegalStateException("Synthetic persistence error")
        val failure = assertThrows(IllegalStateException::class.java) {
            finishPrimaryCaptureObservation({ throw original }, { throw persistence })
        }
        assertSame(original, failure); assertSame(persistence, failure.suppressed.single())
        assertSame(persistence, assertThrows(IllegalStateException::class.java) {
            finishPrimaryCaptureObservation({ true }, { throw persistence })
        })
    }
}
