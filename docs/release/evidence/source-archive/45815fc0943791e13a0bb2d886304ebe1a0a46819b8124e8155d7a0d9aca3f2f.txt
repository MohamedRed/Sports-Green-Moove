package be.sportgreenmoove.app.ui

import android.os.Handler
import android.os.Looper
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class PrimaryCaptureWindowCalibrationTest {
    @Test fun aShortOperationObservesTheLaterBlockedMainThreadBeforeItFinishes() {
        val handler = Handler(Looper.getMainLooper())
        val started = CountDownLatch(1)
        val released = CountDownLatch(1)
        val finished = CountDownLatch(1)
        val block = Runnable {
            started.countDown()
            try { check(released.await(2, TimeUnit.SECONDS)) }
            finally { finished.countDown() }
        }
        try {
            assertTrue(handler.postDelayed(block, 400))
            val result = observeControlledOperation(1_100)
            assertEquals(0L, started.count)
            assertTrue(result.getLong("elapsedMs") < 1_600)
            val samples = result.getJSONArray("samples")
            val later = (0 until samples.length()).map(samples::getJSONObject)
                .single { it.getLong("offsetMs") == 750L }
            assertTrue(later.getLong("atMs") < result.getLong("elapsedMs"))
            assertTrue(later.getLong("atMs") >= 750)
            val frames = later.getJSONArray("mainFrames")
            assertTrue((0 until frames.length()).map(frames::getJSONObject).any {
                it.getString("className") == CountDownLatch::class.java.name && it.getString("methodName") == "await"
            })
            assertFalse((0 until samples.length()).map(samples::getJSONObject).any { it.getLong("offsetMs") == 1_600L })
        } finally {
            released.countDown()
            handler.removeCallbacks(block)
            if (started.count == 0L) assertTrue(finished.await(1, TimeUnit.SECONDS))
        }
    }

    @Test fun aLongerOperationStillRetainsTheLateSampleWithExactlyThreeSamples() {
        val result = observeControlledOperation(1_750)
        val samples = result.getJSONArray("samples")
        assertEquals(listOf(250L, 750L, 1_600L), (0 until samples.length()).map {
            samples.getJSONObject(it).getLong("offsetMs")
        })
        assertEquals(3, samples.length())
    }

    private fun observeControlledOperation(durationMs: Long): JSONObject {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.cacheDir, "capture-window-calibration-${UUID.randomUUID()}")
        check(!directory.exists() && directory.mkdirs())
        val value = Any()
        var calls = 0
        try {
            val actual = observePrimaryCapture("trip-change-parent-review-large-text.png", true,
                { name -> PrimaryCaptureProbe(name, directory) }) {
                calls++
                assertFalse(CountDownLatch(1).await(durationMs, TimeUnit.MILLISECONDS))
                value
            }
            assertSame(value, actual)
            assertEquals(1, calls)
            val record = JSONObject(checkNotNull(directory.listFiles()).single().readText())
            assertEquals("returned", record.getString("primaryOutcome"))
            assertTrue(record.getBoolean("observerClosed"))
            assertTrue(record.getBoolean("observerTerminationVerified"))
            assertFalse(record.getBoolean("imagesWrittenByObserver"))
            return record
        } finally {
            check(directory.deleteRecursively())
            check(!directory.exists())
        }
    }
}
