package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.domain.ConversationTimeline
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.CancellationException

internal class ConversationState(private val ref: ConversationRef, private val gateway: ConversationGateway) {
    private val timeline = ConversationTimeline()
    var messages by mutableStateOf(emptyList<ConversationMessage>())
        private set
    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var earlierError by mutableStateOf<String?>(null)
        private set
    var readError by mutableStateOf<String?>(null)
        private set
    var loadingEarlier by mutableStateOf(false)
        private set
    var hasEarlier by mutableStateOf(false)
        private set
    var participantNames by mutableStateOf(emptyList<String>())
        private set
    private var acknowledging = false

    suspend fun observe() {
        loading = true
        error = null
        try {
            gateway.observeConversation(ref).collect { page ->
                participantNames = page.participantNames
                timeline.applyLatest(page)
                publish()
                loading = false
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure); loading = false }
    }

    suspend fun loadEarlier() {
        val cursor = timeline.olderCursorId ?: return
        if (loadingEarlier) return
        loadingEarlier = true
        earlierError = null
        try {
            timeline.applyEarlier(cursor, gateway.loadEarlier(ref, cursor))
            publish()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { earlierError = UserFacingErrorPolicy.messageFor(failure) }
        finally { loadingEarlier = false }
    }

    suspend fun markVisibleRead(visibleIds: List<String>) {
        if (acknowledging) return
        val ids = messages.filter { it.needsRead && it.id in visibleIds }.map { it.id }.take(50)
        if (ids.isEmpty()) return
        acknowledging = true
        try {
            gateway.markRead(ref, ids)
            timeline.markRead(ids)
            publish()
            readError = null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { readError = "Lecture non synchronisée." }
        finally { acknowledging = false }
    }

    private fun publish() { messages = timeline.messages; hasEarlier = timeline.olderCursorId != null }
}
