package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.domain.ConversationDirectoryTimeline
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.CancellationException

internal class ConversationDirectoryState(private val gateway: ConversationGateway) {
    private val timeline = ConversationDirectoryTimeline()
    var items by mutableStateOf(emptyList<ConversationListItem>())
        private set
    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var earlierError by mutableStateOf<String?>(null)
        private set
    var loadingEarlier by mutableStateOf(false)
        private set
    var hasEarlier by mutableStateOf(false)
        private set

    suspend fun refreshLatest() {
        try {
            timeline.applyLatest(gateway.loadConversations())
            publish()
            error = null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { fail(failure) }
        finally { loading = false }
    }

    suspend fun loadEarlier() {
        val token = timeline.nextCursor ?: return
        if (loadingEarlier) return
        loadingEarlier = true
        earlierError = null
        try { timeline.applyEarlier(token, gateway.loadConversations(token)); publish() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { earlierError = UserFacingErrorPolicy.messageFor(failure) }
        finally { loadingEarlier = false }
    }

    fun fail(failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure); loading = false }
    private fun publish() { items = timeline.items; hasEarlier = timeline.nextCursor != null }
}
