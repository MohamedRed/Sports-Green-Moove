package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.domain.ConversationTimeline
import be.sportgreenmoove.app.services.TeamConversationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class TeamConversationState(private val uid: String, private val target: TeamConversationTarget,
    private val gateway: TeamConversationGateway) {
    private var generation = 0L
    private var timeline = ConversationTimeline()
    private var version: String? = null
    private var busy = false
    var messages by mutableStateOf(emptyList<ConversationMessage>()); private set
    var title by mutableStateOf<String?>(null); private set
    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set
    var loadingEarlier by mutableStateOf(false); private set
    var hasEarlier by mutableStateOf(false); private set

    suspend fun refresh() {
        if (busy) return
        val ticket = generation; busy = true
        try {
            val page = gateway.messages(uid, target); currentCoroutineContext().ensureActive()
            if (ticket != generation) return
            if (version != page.accessVersion) timeline = ConversationTimeline()
            version = page.accessVersion; title = page.title
            timeline.applyLatest(ConversationPage(page.messages, page.olderCursor)); publish()
            error = null; loading = false
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (ticket == generation) fail() }
        finally { if (ticket == generation) busy = false }
    }
    suspend fun earlier() {
        val cursor = timeline.olderCursorId ?: return
        if (busy || error != null) return
        val ticket = generation; val expectedVersion = version; busy = true; loadingEarlier = true
        try {
            val page = gateway.messages(uid, target, cursor); currentCoroutineContext().ensureActive()
            if (ticket != generation) return
            check(page.accessVersion == expectedVersion) { "Conversation authority changed" }
            timeline.applyEarlier(cursor, ConversationPage(page.messages, page.olderCursor)); publish()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (ticket == generation) fail() }
        finally { if (ticket == generation) { busy = false; loadingEarlier = false } }
    }
    private fun publish() { messages = timeline.messages; hasEarlier = timeline.olderCursorId != null }
    private fun fail() {
        clear(); loading = false; error = "Impossible de vérifier la conversation. Actualisez."
    }
    fun clear() {
        generation++; timeline = ConversationTimeline(); version = null; messages = emptyList(); title = null
        loading = true; error = null; hasEarlier = false; loadingEarlier = false; busy = false
    }
}
