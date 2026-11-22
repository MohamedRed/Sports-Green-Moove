package be.sportgreenmoove.app.services

internal data class NativeServerTimeAnchor(
    val serverTimeMs: Long,
    val receivedElapsedNanos: Long,
    val requestStartedElapsedNanos: Long,
) {
    init {
        require(serverTimeMs in 1..MAX_SAFE_TIME)
        require(requestStartedElapsedNanos > 0 && receivedElapsedNanos >= requestStartedElapsedNanos)
    }

    companion object {
        const val MAX_SAFE_TIME = 9_007_199_254_740_991L

        fun fromResponse(response: Any?, started: Long, received: Long): NativeServerTimeAnchor {
            val value = ((response as? Map<*, *>)?.get("serverTimeMs") as? Number)?.toDouble()
            require(value != null && value.isFinite() && value >= 1 && value <= MAX_SAFE_TIME.toDouble() && value % 1.0 == 0.0)
            return NativeServerTimeAnchor(value.toLong(), received, started)
        }
    }
}

internal data class NativeCaptureClockState(
    val anchors: List<NativeServerTimeAnchor>,
    val minimumElapsedNanos: Long = 1,
    val effectiveFromElapsedNanos: List<Long> = anchors.map { it.receivedElapsedNanos },
    val maximumAssignedElapsedNanos: Long = 0,
) {
    init {
        require(anchors.isNotEmpty() && anchors.size <= 256)
        require(effectiveFromElapsedNanos.size == anchors.size && maximumAssignedElapsedNanos >= 0)
        require(minimumElapsedNanos > 0 && minimumElapsedNanos <= effectiveFromElapsedNanos.first())
        require(effectiveFromElapsedNanos.zipWithNext().all { (first, next) -> next > first })
        require(anchors.indices.all { effectiveFromElapsedNanos[it] >= anchors[it].receivedElapsedNanos })
        require(anchors.zipWithNext().all { (first, next) -> next.receivedElapsedNanos > first.receivedElapsedNanos &&
            next.requestStartedElapsedNanos > first.requestStartedElapsedNanos })
    }
}

internal class NativeCaptureClock(initial: NativeCaptureClockState) {
    constructor(initial: NativeServerTimeAnchor) : this(NativeCaptureClockState(listOf(initial)))
    private val anchors = initial.anchors.toMutableList()
    private val effectiveFrom = initial.effectiveFromElapsedNanos.toMutableList()
    private var minimumElapsedNanos = initial.minimumElapsedNanos
    private var maximumAssignedElapsedNanos = initial.maximumAssignedElapsedNanos

    @Synchronized fun snapshot(): NativeServerTimeAnchor = anchors.last()
    @Synchronized fun state(): NativeCaptureClockState = NativeCaptureClockState(anchors.toList(), minimumElapsedNanos,
        effectiveFrom.toList(), maximumAssignedElapsedNanos)

    @Synchronized fun capturedAt(captureElapsedNanos: Long, nowElapsedNanos: Long): Long {
        require(nowElapsedNanos >= anchors.last().receivedElapsedNanos)
        require(captureElapsedNanos >= minimumElapsedNanos && captureElapsedNanos <= nowElapsedNanos)
        val index = effectiveFrom.indexOfLast { it <= captureElapsedNanos }.coerceAtLeast(0)
        val anchor = anchors[index]
        val value = anchor.serverTimeMs + Math.floorDiv(captureElapsedNanos - anchor.receivedElapsedNanos, NANOS_PER_MS)
        require(value in 1..NativeServerTimeAnchor.MAX_SAFE_TIME)
        maximumAssignedElapsedNanos = maxOf(maximumAssignedElapsedNanos, captureElapsedNanos)
        return value
    }

    fun observe(response: Any?, started: Long, received: Long) = observe(NativeServerTimeAnchor.fromResponse(response, started, received))

    @Synchronized fun observe(next: NativeServerTimeAnchor) {
        val previous = anchors.last()
        if (next.requestStartedElapsedNanos <= previous.requestStartedElapsedNanos || next.receivedElapsedNanos <= previous.receivedElapsedNanos) return
        // Publish prospectively, including when another callback mapped a fix after this response arrived.
        require(maximumAssignedElapsedNanos < Long.MAX_VALUE && effectiveFrom.last() < Long.MAX_VALUE)
        effectiveFrom.add(maxOf(next.receivedElapsedNanos, maximumAssignedElapsedNanos + 1, effectiveFrom.last() + 1))
        anchors.add(next)
        if (anchors.size > 256) {
            anchors.removeAt(0)
            effectiveFrom.removeAt(0)
            minimumElapsedNanos = effectiveFrom.first()
        }
    }

    companion object { private const val NANOS_PER_MS = 1_000_000L }
}
