package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.TripChangeHistoryEntry
import be.sportgreenmoove.app.services.TripChangeGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class TripChangeHistoryState(private val tripId: String, private val gateway: TripChangeGateway) {
    var items by mutableStateOf<List<TripChangeHistoryEntry>>(emptyList()); private set
    var busy by mutableStateOf(false); private set
    var loaded by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var cursor: String? = null
    private var closed = false
    private var generation = 0L
    val hasMore get() = cursor != null

    suspend fun reload() = load(reset = true)
    suspend fun more() { if (hasMore && error == null) load(reset = false) }

    private suspend fun load(reset: Boolean) {
        if (closed || busy) return
        val ticket = ++generation
        val requestedCursor = if (reset) null else cursor ?: return
        busy = true; error = null
        if (reset) { items = emptyList(); cursor = null; loaded = false }
        try {
            val page = gateway.tripChangeHistory(tripId, requestedCursor)
            currentCoroutineContext().ensureActive()
            if (closed || generation != ticket) return
            check(page.tripId == tripId && page.items.all { it.tripId == tripId })
            check(page.items.size <= 10 && page.items.map { it.proposalId }.distinct().size == page.items.size)
            check(page.nextCursor == null || (page.items.isNotEmpty() && page.nextCursor != requestedCursor))
            check(reset || page.items.none { next -> items.any { it.proposalId == next.proposalId } })
            items = if (reset) page.items else items + page.items
            cursor = page.nextCursor; loaded = true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            if (!closed && generation == ticket) {
                items = emptyList(); cursor = null; loaded = false
                error = "Impossible de vérifier l’historique. Actualisez pour réessayer."
            }
        } finally { if (!closed && generation == ticket) busy = false }
    }

    fun close() { closed = true; generation++; items = emptyList(); cursor = null; loaded = false; busy = false; error = null }
}
