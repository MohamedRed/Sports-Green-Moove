package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.SupportGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class SupportInboxState(private val uid: String, private val gateway: SupportGateway) {
    var reports by mutableStateOf<List<SupportReport>>(emptyList()); private set
    var detail by mutableStateOf<SupportDetail?>(null); private set
    var selectedId by mutableStateOf<String?>(null); private set
    var busy by mutableStateOf(false); private set
    var loaded by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var cursor: String? = null
    private var generation = 0L
    private var closed = false
    val hasMore get() = cursor != null && error == null

    suspend fun refresh() = load(true)
    suspend fun more() { if (hasMore && !busy) load(false) }
    suspend fun open(id: String) { invalidate(); selectedId = id; load(true) }
    suspend fun back() { invalidate(); selectedId = null; load(true) }
    private fun invalidate() { generation++; busy = false; reports = emptyList(); detail = null; loaded = false; error = null; cursor = null }
    fun clear() { invalidate() }
    fun close() { clear(); closed = true }

    private suspend fun load(reset: Boolean) {
        if (closed || busy) return
        val requested = if (reset) null else cursor ?: return
        val id = selectedId; val ticket = ++generation
        busy = true; error = null
        if (reset) { reports = emptyList(); detail = null; cursor = null; loaded = false }
        try {
            if (id == null) {
                val page = gateway.supportReports(uid, requested)
                currentCoroutineContext().ensureActive()
                if (closed || generation != ticket) return
                validate(page, requested, reports.map { it.id }) { it.id }
                reports = if (reset) page.items else reports + page.items
                cursor = page.nextCursor
            } else {
                val next = gateway.supportReport(uid, id, requested)
                currentCoroutineContext().ensureActive()
                if (closed || generation != ticket) return
                check(next.report.id == id)
                val prior = if (reset) null else detail
                check(prior == null || next.report == prior.report)
                validate(next.replies, requested, prior?.replies?.items?.map { it.id }.orEmpty()) { it.id }
                val replies = prior?.replies?.items.orEmpty() + next.replies.items
                check(replies.all { it.sequence <= next.report.replyCount })
                check(replies.zipWithNext().all { (left, right) -> left.sequence == right.sequence + 1 })
                check(if (replies.isEmpty()) next.report.replyCount == 0L else replies.first() == next.report.lastReply)
                check(next.replies.nextCursor != null || (replies.lastOrNull()?.sequence ?: 1L) == 1L)
                detail = SupportDetail(next.report, SupportPage(replies, next.replies.nextCursor)); cursor = next.replies.nextCursor
            }
            loaded = true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            if (!closed && generation == ticket) {
                reports = emptyList(); detail = null; cursor = null; loaded = false
                error = "Impossible de consulter vos demandes. Actualisez pour réessayer."
            }
        } finally { if (!closed && generation == ticket) busy = false }
    }
    private fun <T> validate(page: SupportPage<T>, requested: String?, prior: List<String>, id: (T) -> String) {
        val ids = page.items.map(id)
        check(ids.size <= 20 && ids.distinct().size == ids.size && ids.none { it in prior })
        check(page.nextCursor == null || (ids.isNotEmpty() && page.nextCursor != requested))
    }
}
