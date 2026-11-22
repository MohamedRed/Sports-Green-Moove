package be.sportgreenmoove.app.ui

import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import org.junit.Assert.*
import org.junit.Test

class SessionFailureObservationTest {
    @Test fun originalFailureIsObservedWhileResumedAndRethrownAfterClosing() {
        val scenario = ActivityScenario.launch(ComponentActivity::class.java)
        val original = AssertionError("original replay failure")
        var observed = false
        try {
            scenario.useWithFailureObservation({ activity ->
                assertEquals(Lifecycle.State.RESUMED, activity.state)
                observed = true
            }) { throw original }
            fail("The original failure must be rethrown")
        } catch (failure: Throwable) { assertSame(original, failure) }
        assertTrue(observed)
        assertEquals(Lifecycle.State.DESTROYED, scenario.state)
    }

    @Test fun failedObservationCannotReplaceTheOriginalFailureOrSkipClosing() {
        val scenario = ActivityScenario.launch(ComponentActivity::class.java)
        val original = AssertionError("original replay failure")
        val diagnostic = IllegalStateException("diagnostic unavailable")
        try {
            scenario.useWithFailureObservation({ throw diagnostic }) { throw original }
            fail("The original failure must be rethrown")
        } catch (failure: Throwable) {
            assertSame(original, failure)
            assertArrayEquals(arrayOf(diagnostic), failure.suppressed)
        }
        assertEquals(Lifecycle.State.DESTROYED, scenario.state)
    }

    @Test fun successClosesWithoutGeneratingAFailureObservation() {
        val scenario = ActivityScenario.launch(ComponentActivity::class.java)
        var completed = false
        scenario.useWithFailureObservation({ fail("Successful replay must not generate failure evidence") }) {
            assertEquals(Lifecycle.State.RESUMED, it.state)
            completed = true
        }
        assertTrue(completed)
        assertEquals(Lifecycle.State.DESTROYED, scenario.state)
    }
}
