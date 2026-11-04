package be.sportgreenmoove.app.ui

import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ActivityWindowObservationTest {
    @get:Rule val compose = createEmptyComposeRule()

    @Test fun observationPrecedesCloseWithoutExportingTheDisplayedText() {
        val original = AssertionError("original flow failure")
        var report: JSONObject? = null
        var scenario: ActivityScenario<ComponentActivity>? = null
        ActivityWindowObservation(ComponentActivity::class.java).use { observer ->
            try {
                scenario = ActivityScenario.launch(ComponentActivity::class.java)
                scenario!!.useWithFailureObservation({
                    assertEquals(Lifecycle.State.RESUMED, it.state)
                    report = observer.snapshot()
                }) { activity ->
                    activity.onActivity { it.setContent { Text("Do not export this content", Modifier.testTag("observed-window")) } }
                    compose.onNodeWithTag("observed-window").assertExists()
                    observer.phase(GuardianWindowPhase.ParentClubAction)
                    throw original
                }
                fail("Original failure was not rethrown")
            } catch (failure: Throwable) { assertSame(original, failure) }
            val captured = requireNotNull(report)
            assertTrue(captured.getBoolean("registrationObserved"))
            assertTrue(captured.getBoolean("mainThreadObserved"))
            assertEquals("ParentClubAction", captured.getString("phase"))
            val window = captured.getJSONObject("window")
            assertEquals("RESUMED", window.getString("stage"))
            assertFalse(window.getBoolean("destroyed"))
            assertTrue(window.getInt("composeHosts") > 0)
            assertTrue(window.getInt("composeOwners") > 0)
            assertFalse(window.getBoolean("treeTruncated"))
            assertFalse(captured.toString().contains("Do not export this content"))
        }
        assertEquals(Lifecycle.State.DESTROYED, scenario!!.state)
    }

    @Test fun closingUnregistersCallbacksAndRejectsLaterObservation() {
        val observer = ActivityWindowObservation(ComponentActivity::class.java)
        ActivityScenario.launch(ComponentActivity::class.java).use {
            observer.phase(GuardianWindowPhase.ParentHomeObserved)
            assertTrue(observer.snapshot().getJSONObject("window").getBoolean("activityObserved"))
        }
        observer.close()
        val count = observer.eventCount
        ActivityScenario.launch(ComponentActivity::class.java).use { it.recreate() }
        assertEquals(count, observer.eventCount)
        assertThrows(IllegalStateException::class.java) { observer.snapshot() }
        assertThrows(IllegalStateException::class.java) { observer.phase(GuardianWindowPhase.DriverLogin) }
        observer.close()
    }

    @Test fun anUnavailableMainThreadIsReportedWithoutWaitingForItToRecover() {
        ActivityWindowObservation(ComponentActivity::class.java).use { observer ->
            ActivityScenario.launch(ComponentActivity::class.java).use {
                val handler = Handler(Looper.getMainLooper())
                val entered = CountDownLatch(1)
                val release = CountDownLatch(1)
                val block = Runnable { entered.countDown(); release.await() }
                handler.post(block)
                try {
                    assertTrue(entered.await(5, TimeUnit.SECONDS))
                    val report = observer.snapshot()
                    assertFalse(report.getBoolean("mainThreadObserved"))
                    assertEquals("TimeoutException", report.getString("observationFailureClass"))
                    assertFalse(report.has("window"))
                } finally {
                    release.countDown(); handler.removeCallbacks(block)
                }
                assertTrue(observer.snapshot().getBoolean("mainThreadObserved"))
            }
        }
    }
}
