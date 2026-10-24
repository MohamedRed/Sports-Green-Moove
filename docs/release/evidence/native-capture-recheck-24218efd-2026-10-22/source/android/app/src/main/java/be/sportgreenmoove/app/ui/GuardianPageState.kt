package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.GuardianPage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class GuardianPageState<T>(private val read: suspend (String?) -> GuardianPage<T>, private val id: (T) -> String) {
    var items by mutableStateOf<List<T>>(emptyList()); private set
    var loaded by mutableStateOf(false); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var cursor: String? = null
    private val seen = mutableSetOf<String>()
    private var generation = 0L
    private var closed = false
    val hasMore get() = cursor != null

    suspend fun reload() = load(true)
    suspend fun more() { if (hasMore && error == null) load(false) }
    private suspend fun load(reset: Boolean) {
        if (closed || busy) return
        val requested = if (reset) null else cursor ?: return
        val ticket = ++generation
        busy = true; error = null
        if (reset) { items = emptyList(); cursor = null; loaded = false; seen.clear() }
        try {
            val page = read(requested)
            currentCoroutineContext().ensureActive()
            if (closed || generation != ticket) return
            check(page.items.size <= 20 && page.items.map(id).distinct().size == page.items.size)
            check(reset || page.items.none { next -> items.any { id(it) == id(next) } })
            check(page.nextCursor == null || page.nextCursor != requested && page.nextCursor !in seen)
            requested?.let(seen::add)
            items = if (reset) page.items else items + page.items
            cursor = page.nextCursor; loaded = true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (!closed && generation == ticket) {
            items = emptyList(); loaded = false; cursor = null; error = "Impossible de charger la liste. Actualisez."
        } } finally { if (!closed && generation == ticket) busy = false }
    }
    fun close() { closed = true; generation++; items = emptyList(); cursor = null; seen.clear(); loaded = false; busy = false; error = null }
}
