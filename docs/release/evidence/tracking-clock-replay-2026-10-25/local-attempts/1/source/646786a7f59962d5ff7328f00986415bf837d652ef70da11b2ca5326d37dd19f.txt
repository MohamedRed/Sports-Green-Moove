package be.sportgreenmoove.app.ui

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

internal fun LocalMockLocation.withCaptureFeed(capturedAt: Long, captureElapsedNanos: Long? = null, action: () -> Unit) {
    fun update() { if (captureElapsedNanos == null) emit(capturedAt) else emit(capturedAt, captureElapsedNanos) }
    update()
    val sensorError = AtomicReference<Throwable?>()
    val scheduler = Executors.newSingleThreadScheduledExecutor()
    val task = scheduler.scheduleWithFixedDelay({
        if (sensorError.get() == null) {
            try { update() }
            catch (error: Throwable) { sensorError.compareAndSet(null, error) }
        }
    }, 500, 500, TimeUnit.MILLISECONDS)
    var failure: Throwable? = null
    try { action() } catch (error: Throwable) { failure = error }
    task.cancel(false)
    scheduler.shutdown()
    fun record(error: Throwable) { if (failure == null) failure = error else failure!!.addSuppressed(error) }
    if (!scheduler.awaitTermination(20, TimeUnit.SECONDS)) record(IllegalStateException("Mock location feed did not stop"))
    sensorError.get()?.let(::record)
    failure?.let { throw it }
}
