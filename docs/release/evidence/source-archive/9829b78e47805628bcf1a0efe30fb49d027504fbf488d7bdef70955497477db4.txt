package be.sportgreenmoove.app.ui

import android.os.Handler
import android.os.Looper
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal val primaryCaptureSampleOffsetsMs = listOf(250L, 1_200L, 1_600L)

internal class PrimaryCaptureProbe(private val name: String) : PrimaryCaptureObservation {
    private val start = System.nanoTime()
    private val caller = Thread.currentThread()
    private val main = Looper.getMainLooper().thread
    private val handler = Handler(Looper.getMainLooper())
    private val lock = Any()
    private val delays = mutableListOf<Long>()
    private val heartbeatTimes = mutableListOf<Long>()
    private val samples = mutableListOf<JSONObject>()
    private var closed = false
    private var terminationVerified: Boolean? = null
    private var outcome = "prepared"
    private var category = "none"
    private var duration = 0L
    private var primaryStartOffset: Long? = null
    private var primaryDuration: Long? = null
    private var sampleFailures = 0
    private val output: File
    private val executor = Executors.newSingleThreadScheduledExecutor { task ->
        Thread(task, "sgm-capture-observer").apply { isDaemon = true }
    }
    private var expectedHeartbeat = 0L
    private var heartbeatClockStarted = false
    private val heartbeat = object : Runnable {
        override fun run() {
            val now = System.nanoTime()
            synchronized(lock) {
                if (closed) return
                if (heartbeatClockStarted && delays.size < 64) {
                    delays += TimeUnit.NANOSECONDS.toMillis((now - expectedHeartbeat).coerceAtLeast(0))
                    heartbeatTimes += TimeUnit.NANOSECONDS.toMillis(now - start)
                }
                heartbeatClockStarted = true
                expectedHeartbeat = now + TimeUnit.MILLISECONDS.toNanos(50)
                handler.postDelayed(this, 50)
            }
        }
    }
    private var posted = false

    init {
        check(Regex("trip-change-[a-z0-9-]+\\.png").matches(name))
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),
            "primary-capture-diagnostics")
        check(directory.isDirectory || directory.mkdirs())
        output = File(directory, "${name.removeSuffix(".png")}-${java.lang.Long.toUnsignedString(start)}.json")
        check(!output.exists())
        try {
            writeSnapshot()
            posted = handler.post(heartbeat)
            for (at in primaryCaptureSampleOffsetsMs) {
                val scheduledAt = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(at)
                executor.schedule({
                    try { sample(at, scheduledAt) }
                    catch (_: Throwable) { synchronized(lock) { if (!closed) sampleFailures++ } }
                }, at, TimeUnit.MILLISECONDS)
            }
        } catch (failure: Throwable) {
            synchronized(lock) { closed = true }
            handler.removeCallbacks(heartbeat); executor.shutdownNow()
            throw failure
        }
    }

    private fun elapsed() = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)
    private fun frames(thread: Thread) = JSONArray(thread.stackTrace.take(20).map { frame ->
        JSONObject().put("className", frame.className).put("methodName", frame.methodName)
            .put("fileName", frame.fileName ?: "").put("lineNumber", frame.lineNumber)
    })
    private fun sample(offsetMs: Long, scheduledAtNs: Long) {
        val observed = elapsed()
        val scheduledMs = TimeUnit.NANOSECONDS.toMillis(scheduledAtNs - start)
        val value = JSONObject().put("atMs", observed).put("scheduledMs", scheduledMs).put("offsetMs", offsetMs)
            .put("observerDelayMs", (observed - scheduledMs).coerceAtLeast(0))
            .put("mainState", main.state.name).put("mainFrames", frames(main)).put("callerFrames", frames(caller))
        synchronized(lock) { if (!closed && samples.size < 3) samples += value }
    }

    override fun complete(failure: Throwable?, operationStartedAtNs: Long, operationCompletedAtNs: Long) {
        synchronized(lock) {
            check(!closed)
            duration = TimeUnit.NANOSECONDS.toMillis(operationCompletedAtNs - start)
            primaryStartOffset = TimeUnit.NANOSECONDS.toMillis(operationStartedAtNs - start)
            primaryDuration = TimeUnit.NANOSECONDS.toMillis(operationCompletedAtNs - operationStartedAtNs)
            outcome = if (failure == null) "returned" else "threw"
            category = when {
                failure == null -> "none"
                failure is AssertionError && failure.message == "Failed waiting for PixelCopy!" -> "pixelcopy-callback-wait"
                else -> "other"
            }
        }
    }

    override fun close() {
        synchronized(lock) { check(!closed); closed = true }
        finishPrimaryCaptureObservation(awaitTermination = {
            handler.removeCallbacks(heartbeat)
            executor.shutdownNow()
            executor.awaitTermination(100, TimeUnit.MILLISECONDS)
        }, persist = { stopped ->
            synchronized(lock) { terminationVerified = stopped }
            writeSnapshot()
        })
    }

    private fun writeSnapshot() {
        val value = synchronized(lock) {
            JSONObject().put("schemaVersion", 3).put("scope", "primary-compose-capture-observation-not-flow-or-root-cause-proof")
                .put("sampleScheduleMs", JSONArray(primaryCaptureSampleOffsetsMs))
                .put("captureName", name).put("sdkInvocations", if (outcome == "prepared") 0 else 1).put("primaryOutcome", outcome)
                .put("errorCategory", category).put("elapsedMs", duration).put("callerIsMain", caller === main)
                .put("primaryStartOffsetMs", primaryStartOffset ?: JSONObject.NULL)
                .put("primaryElapsedMs", primaryDuration ?: JSONObject.NULL)
                .put("mainPostAccepted", posted).put("heartbeatDelaysMs", JSONArray(delays))
                .put("heartbeatAtMs", JSONArray(heartbeatTimes))
                .put("maxMainQueueDelayMs", delays.maxOrNull() ?: JSONObject.NULL).put("samples", JSONArray(samples))
                .put("sampleFailures", sampleFailures)
                .put("observerClosed", closed).put("observerTerminationVerified", terminationVerified ?: JSONObject.NULL)
                .put("observerMayAffectScheduling", true).put("imagesWrittenByObserver", false)
        }
        output.writeText(value.toString(2) + "\n")
    }
}
