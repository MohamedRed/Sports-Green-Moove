package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import java.time.Instant

class UiFlowConversationGateway : ConversationGateway {
    data class Request(val ref: ConversationRef, val body: String, val requestId: String)
    val requests = mutableListOf<Request>()
    val readIds = mutableSetOf<String>()
    var sendFailure: Exception? = null
    var observeFailure: Exception? = null
    val current = MutableStateFlow(ConversationPage(listOf(
        ConversationMessage("received-1", "Départ confirmé.", false, Instant.now().epochSecond, needsRead = true),
    ), null))

    override fun observeInboxChanges(): Flow<Unit> = flowOf(Unit)
    override fun observeConversation(ref: ConversationRef): Flow<ConversationPage> =
        observeFailure?.let { failure -> kotlinx.coroutines.flow.flow { throw failure } } ?: current
    override suspend fun loadEarlier(ref: ConversationRef, cursorId: String): ConversationPage =
        error("No earlier fixture page configured")
    override suspend fun markRead(ref: ConversationRef, messageIds: List<String>) {
        readIds.addAll(messageIds)
        current.value = current.value.copy(messages = current.value.messages.map {
            if (it.id in messageIds) it.copy(needsRead = false) else it
        })
    }
    override suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String {
        requests.add(Request(ref, body, requestId))
        sendFailure?.let { throw it }
        if (current.value.messages.none { it.id == requestId }) current.value = current.value.copy(
            messages = listOf(ConversationMessage(requestId, body, true, Instant.now().epochSecond + 1, requestId = requestId)) + current.value.messages,
        )
        return requestId
    }
}
