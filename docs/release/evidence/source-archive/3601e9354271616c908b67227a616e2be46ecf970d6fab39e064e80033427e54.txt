package be.sportgreenmoove.app.services

import java.util.concurrent.atomic.AtomicLong

internal enum class RideObservationEvent {
    Opened, Connected, ConnectionFailed, LocationChanged, LocationFailed,
    RideCached, RideServer, RideFailed, FetchStarted, FetchCompleted, FetchCancelled, FetchFailed, Closed,
}

// Only enum events and connection booleans can enter this diagnostic channel.
internal class RideObservationTrace(private val clock: () -> Long, private val sink: (String) -> Unit) {
    private val id = nextId.incrementAndGet()
    private val sequence = AtomicLong()
    private val started = clock()

    fun record(event: RideObservationEvent, connected: Boolean? = null) {
        require(connected == null || event == RideObservationEvent.Connected)
        sink("observer=$id sequence=${sequence.incrementAndGet()} elapsedMs=${(clock() - started).coerceAtLeast(0)}" +
            " event=${event.name}" + (connected?.let { " connected=$it" } ?: ""))
    }

    companion object { private val nextId = AtomicLong() }
}
