package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.PendingReviewGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class PendingReviewsState(private val uid: String, private val gateway: PendingReviewGateway) {
    var items by mutableStateOf(emptyList<InboxReviewPrompt>()); private set
    var nextCursor by mutableStateOf<String?>(null); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var revision = 0L
    private var closed = false
    private val submittedIds = mutableSetOf<String>()

    fun replace(items: List<InboxReviewPrompt>, cursor: String?) {
        if (closed) return
        revision += 1
        this.items = items.filterNot { it.id in submittedIds }.distinctBy { it.id }
        nextCursor = cursor; error = null
    }
    fun submitted(id: String) {
        if (closed) return
        submittedIds += id
        items = items.filterNot { it.id == id }
    }
    fun close() {
        closed = true; revision += 1; items = emptyList(); nextCursor = null; error = null; loading = false; submittedIds.clear()
    }
    suspend fun loadMore() {
        val cursor = nextCursor ?: return
        if (closed || loading) return
        val version = revision
        loading = true; error = null
        try {
            val page = gateway.loadPendingReviews(cursor)
            currentCoroutineContext().ensureActive()
            if (closed || version != revision) return
            check(page.userId == uid && page.nextCursor != cursor)
            items = (items + page.items).filterNot { it.id in submittedIds }.distinctBy { it.id }
            nextCursor = page.nextCursor
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (!closed && version == revision) error = UserFacingErrorPolicy.messageFor(failure) }
        finally { if (!closed) loading = false }
    }
}
