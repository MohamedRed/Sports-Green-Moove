package be.sportgreenmoove.app.services

import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

internal enum class SupportCallOutcome { SUCCEEDED, CANCELLED, FAILED }

internal class SupportCallTrace(private val enabled: Boolean, private val pid: Int,
    private val emit: (Map<String, Any>) -> Unit) {
    private val sequence = AtomicInteger()

    fun start(requestId: String): ((SupportCallOutcome) -> Unit)? {
        if (!enabled) return null
        require(UUID.fromString(requestId).toString() == requestId)
        val identity = mapOf<String, Any>("operation" to requestId, "call" to sequence.incrementAndGet(), "pid" to pid)
        emit(identity + ("event" to "call-start"))
        val completed = AtomicBoolean(false)
        return { outcome ->
            if (completed.compareAndSet(false, true))
                emit(identity + mapOf("event" to "call-terminal", "outcome" to outcome.name.lowercase()))
        }
    }
}
