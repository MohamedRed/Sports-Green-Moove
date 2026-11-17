package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.domain.ConversationTimeline
import be.sportgreenmoove.app.services.TeamConversationGateway
import be.sportgreenmoove.app.services.TeamConversationReadRejectedException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class TeamConversationState(private val uid: String, private val target: TeamConversationTarget,
    private val gateway: TeamConversationGateway) {
    private var generation = 0L
    private var timeline = ConversationTimeline()
    private var version: String? = null
    private var busy = false
    private var readSerial = 0L
    private var activeRead: Long? = null
    private val acknowledgedReads = mutableSetOf<String>()
    var messages by mutableStateOf(emptyList<ConversationMessage>()); private set
    var title by mutableStateOf<String?>(null); private set
    var loading by mutableStateOf(true); private set
    var error by mutableStateOf<String?>(null); private set
    var loadingEarlier by mutableStateOf(false); private set
    var hasEarlier by mutableStateOf(false); private set
    var readError by mutableStateOf<String?>(null); private set

    suspend fun refresh() {
        if (busy) return
        val ticket = generation; busy = true
        try {
            val page = gateway.messages(uid, target); currentCoroutineContext().ensureActive()
            if (ticket != generation) return
            if (version != page.accessVersion) { timeline = ConversationTimeline(); acknowledgedReads.clear(); readError = null }
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
    suspend fun markVisibleRead(visibleIds: List<String>) {
        if (activeRead != null || error != null) return
        val expectedVersion = version ?: return
        val ids = messages.filter { it.needsRead && !it.mine && it.id in visibleIds }.map { it.id }.take(50)
        if (ids.isEmpty()) return
        val ticket = generation; val request = ++readSerial; activeRead = request
        try {
            gateway.markRead(uid, target, expectedVersion, ids); currentCoroutineContext().ensureActive()
            if (ticket == generation && version == expectedVersion) { acknowledgedReads.addAll(ids); publish(); readError = null }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (rejected: TeamConversationReadRejectedException) { if (ticket == generation && version == expectedVersion) fail() }
        catch (_: Exception) { if (ticket == generation && version == expectedVersion) readError = "Lecture non synchronisée." }
        finally { if (activeRead == request) activeRead = null }
    }
    private fun publish() {
        timeline.markRead(acknowledgedReads.toList()); messages = timeline.messages; hasEarlier = timeline.olderCursorId != null
    }
    private fun fail() {
        clear(); loading = false; error = "Impossible de vérifier la conversation. Actualisez."
    }
    fun clear() {
        generation++; timeline = ConversationTimeline(); version = null; messages = emptyList(); title = null
        acknowledgedReads.clear(); activeRead = null; readError = null
        loading = true; error = null; hasEarlier = false; loadingEarlier = false; busy = false
    }
}
