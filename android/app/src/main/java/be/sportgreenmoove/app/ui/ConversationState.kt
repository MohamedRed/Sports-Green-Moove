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
    private var timeline = ConversationTimeline()
    private var generation = 0L
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
        val ticket = ++generation
        clearContent()
        loading = true
        error = null
        try {
            gateway.observeConversation(ref).collect { page ->
                if (ticket != generation) return@collect
                participantNames = page.participantNames
                timeline.applyLatest(page)
                publish()
                loading = false
            }
        } catch (cancelled: CancellationException) {
            if (ticket == generation) { generation++; clearContent(); loading = true }
            throw cancelled
        } catch (failure: Exception) {
            if (ticket == generation) {
                generation++; clearContent()
                error = UserFacingErrorPolicy.messageFor(failure); loading = false
            }
        }
    }

    suspend fun loadEarlier() {
        val cursor = timeline.olderCursorId ?: return
        if (loadingEarlier) return
        val ticket = generation
        loadingEarlier = true
        earlierError = null
        try {
            val page = gateway.loadEarlier(ref, cursor)
            if (ticket != generation) return
            timeline.applyEarlier(cursor, page)
            publish()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (ticket == generation) earlierError = UserFacingErrorPolicy.messageFor(failure) }
        finally { if (ticket == generation) loadingEarlier = false }
    }

    suspend fun markVisibleRead(visibleIds: List<String>) {
        if (acknowledging) return
        val ids = messages.filter { it.needsRead && it.id in visibleIds }.map { it.id }.take(50)
        if (ids.isEmpty()) return
        val ticket = generation
        acknowledging = true
        try {
            gateway.markRead(ref, ids)
            if (ticket != generation) return
            timeline.markRead(ids)
            publish()
            readError = null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (ticket == generation) readError = "Lecture non synchronisée." }
        finally { if (ticket == generation) acknowledging = false }
    }

    private fun clearContent() {
        timeline = ConversationTimeline(); messages = emptyList(); participantNames = emptyList()
        hasEarlier = false; loadingEarlier = false; acknowledging = false; earlierError = null; readError = null
    }

    private fun publish() { messages = timeline.messages; hasEarlier = timeline.olderCursorId != null }
}
