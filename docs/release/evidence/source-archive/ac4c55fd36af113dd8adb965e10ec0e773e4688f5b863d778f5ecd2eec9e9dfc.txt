package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ReceivedRatingSummary
import be.sportgreenmoove.app.services.ReceivedRatingsGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class ReceivedRatingsState(private val uid: String, private val gateway: ReceivedRatingsGateway) {
    var summary by mutableStateOf<ReceivedRatingSummary?>(null); private set
    var busy by mutableStateOf(false); private set
    var failed by mutableStateOf(false); private set
    private var closed = false
    fun close() { closed = true; summary = null; failed = false; busy = false }
    suspend fun refresh() {
        if (closed || busy) return
        busy = true; failed = false; summary = null
        try {
            val result = gateway.readReceivedRatings(uid)
            currentCoroutineContext().ensureActive()
            if (!closed) { check(result.userId == uid); summary = result }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (!closed) failed = true }
        finally { if (!closed) busy = false }
    }
}
