package be.sportgreenmoove.app.ui

import org.junit.Assert.*
import org.junit.Test

class PrimaryCaptureDiagnosticsTest {
    @Test fun sampleScheduleCoversRedrawAndTheLaterCallbackWaitWithoutAddingSamples() {
        assertEquals(listOf(250L, 1_200L, 1_600L), primaryCaptureSampleOffsetsMs)
        assertEquals(3, primaryCaptureSampleOffsetsMs.distinct().size)
    }
    @Test fun thePrimaryOperationRunsOnceAndReturnsTheSameObject() {
        val observer = Observation(); val expected = Any(); var calls = 0
        val actual = observePrimaryCapture("trip-change-test.png", true, {
            observer.readyAt = System.nanoTime(); observer
        }) { calls++; expected }
        assertSame(expected, actual); assertEquals(1, calls); assertNull(observer.failure)
        assertEquals(1, observer.completions); assertEquals(1, observer.closes)
    }
    @Test fun theOriginalCaptureFailureIsRethrownWithoutRetry() {
        val observer = Observation(); val expected = AssertionError("Failed waiting for PixelCopy!"); var calls = 0
        val actual = assertThrows(AssertionError::class.java) {
            observePrimaryCapture("trip-change-test.png", true, { observer }) { calls++; throw expected }
        }
        assertSame(expected, actual); assertSame(expected, observer.failure)
        assertEquals(1, calls); assertEquals(1, observer.closes)
    }
    @Test fun anObserverFailureCannotReplaceEitherPrimaryOutcome() {
        val observer = Observation().apply { closeFailure = IllegalStateException("Synthetic observer error") }
        val expected = AssertionError("Primary failure")
        val actual = assertThrows(AssertionError::class.java) {
            observePrimaryCapture("trip-change-test.png", true, { observer }) { throw expected }
        }
        assertSame(expected, actual); assertSame(observer.closeFailure, actual.suppressed.single())
        val value = Any()
        assertSame(value, observePrimaryCapture("trip-change-test.png", true, { Observation().apply {
            closeFailure = IllegalStateException("Synthetic observer error")
        } }) { value })
        val same = AssertionError("Shared failure instance")
        assertSame(same, assertThrows(AssertionError::class.java) {
            observePrimaryCapture("trip-change-test.png", true, { Observation().apply { closeFailure = same } }) { throw same }
        })
    }
    @Test fun disabledAndUnselectedCapturesDoNotCreateAnObserver() {
        for ((name, enabled) in listOf("trip-change-test.png" to false, "child-contact.png" to true)) {
            var calls = 0
            assertEquals("primary", observePrimaryCapture(name, enabled, { error("Observer must not start") }) {
                calls++; "primary"
            })
            assertEquals(1, calls)
        }
    }
    private class Observation : PrimaryCaptureObservation {
        var failure: Throwable? = null; var closeFailure: Throwable? = null
        var readyAt: Long? = null
        var completions = 0; var closes = 0
        override fun complete(failure: Throwable?, operationStartedAtNs: Long, operationCompletedAtNs: Long) {
            assertTrue(operationCompletedAtNs >= operationStartedAtNs)
            readyAt?.let { assertTrue(operationStartedAtNs >= it) }
            this.failure = failure; completions++
        }
        override fun close() { closes++; closeFailure?.let { throw it } }
    }
}
