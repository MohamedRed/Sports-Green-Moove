package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.data.ConversationPosition
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationBookingPage
import be.sportgreenmoove.app.data.ConversationBookingOption
import be.sportgreenmoove.app.data.ConversationBookingStatus
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import java.time.Instant

class UiFlowConversationGateway : ConversationGateway {
    data class Request(val ref: ConversationRef, val body: String, val requestId: String)
    val requests = mutableListOf<Request>()
    val readIds = mutableSetOf<String>()
    var sendFailure: Exception? = null
    var observeFailure: Exception? = null
    var directoryFailure: Exception? = null
    var bookingFailure: Exception? = null
    private val inboxVersion = MutableStateFlow(0)
    val current = MutableStateFlow(ConversationPage(listOf(
        ConversationMessage("received-1", "Départ confirmé.", false, Instant.now().epochSecond, needsRead = true),
    ), null))

    val threads = mutableMapOf("booking:new-booking-1" to MutableStateFlow(ConversationPage(emptyList(), null)))
    val directoryPages = mutableMapOf<String, ConversationDirectoryPage>()
    val bookingPages = mutableMapOf<String, ConversationBookingPage>()
    override fun observeInboxChanges(): Flow<Unit> = inboxVersion.map { Unit }
    var directory = ConversationDirectoryPage(listOf(ConversationListItem("fixture-chat", ConversationRef(ConversationKind.Booking, "booking-1"),
        "Coach U8", "Départ confirmé.", "16h12", 1, 1, ConversationPosition(1, 0, "fixture-chat"), "15 octobre · 16h12")),
        null, ConversationPosition(1, 0, "fixture-chat"), ConversationPosition(1, 0, "fixture-chat"))
    var bookingOptions = ConversationBookingPage(listOf(ConversationBookingOption(ConversationRef(ConversationKind.Booking, "new-booking-1"),
        "Trajet de Lina", "15 octobre · 16h12", ConversationBookingStatus.Approved, "Conducteur QA", "Lina QA")), null)
    override suspend fun loadConversations(cursor: String?): ConversationDirectoryPage {
        directoryFailure?.let { throw it }
        return if (cursor == null) directory else directoryPages.getValue(cursor)
    }
    override suspend fun loadBookingOptions(cursor: String?): ConversationBookingPage {
        bookingFailure?.let { throw it }
        return if (cursor == null) bookingOptions else bookingPages.getValue(cursor)
    }
    private fun thread(ref: ConversationRef): MutableStateFlow<ConversationPage> =
        if (ref.key == "booking:booking-1") current else threads.getValue(ref.key)
    override fun observeConversation(ref: ConversationRef): Flow<ConversationPage> =
        observeFailure?.let { failure -> kotlinx.coroutines.flow.flow { throw failure } } ?: thread(ref)
    override suspend fun loadEarlier(ref: ConversationRef, cursorId: String): ConversationPage =
        error("No earlier fixture page configured")
    override suspend fun markRead(ref: ConversationRef, messageIds: List<String>) {
        readIds.addAll(messageIds)
        val stream = thread(ref)
        val newlyRead = stream.value.messages.count { it.needsRead && it.id in messageIds }
        stream.value = stream.value.copy(messages = stream.value.messages.map {
            if (it.id in messageIds) it.copy(needsRead = false) else it
        })
        directory = directory.copy(items = directory.items.map {
            if (it.ref == ref) it.copy(unreadCount = it.unreadCount - newlyRead, revision = it.revision + 1) else it
        })
        inboxVersion.value += 1
    }
    override suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String {
        requests.add(Request(ref, body, requestId))
        sendFailure?.let { throw it }
        val stream = thread(ref)
        if (stream.value.messages.none { it.id == requestId }) {
            val at = Instant.now().epochSecond + 1
            stream.value = stream.value.copy(messages = listOf(ConversationMessage(requestId, body, true, at, requestId = requestId)) + stream.value.messages)
            val existing = directory.items.singleOrNull { it.ref == ref }
            val item = if (existing != null) existing.copy(preview = body, revision = existing.revision + 1,
                position = ConversationPosition(at, 0, existing.id)) else {
                val booking = bookingOptions.items.single { it.ref == ref }
                ConversationListItem("fixture-${ref.sourceId}", ref, booking.title, body, "16h12", 0, 1,
                    ConversationPosition(at, 0, "fixture-${ref.sourceId}"), booking.dateLabel, booking.peerLabel, booking.childLabel)
            }
            val items = (directory.items.filterNot { it.ref == ref } + item).sortedByDescending { it.position }
            directory = directory.copy(items = items, newest = items.first().position, oldest = items.last().position)
            inboxVersion.value += 1
        }
        return requestId
    }
}
