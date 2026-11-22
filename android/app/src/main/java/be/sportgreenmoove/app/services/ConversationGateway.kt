package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationPage
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.data.ConversationBookingPage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

interface ConversationGateway {
    fun observeInboxChanges(): Flow<Unit>
    suspend fun loadConversations(cursor: String? = null): ConversationDirectoryPage
    suspend fun loadBookingOptions(cursor: String? = null): ConversationBookingPage
    fun observeConversation(ref: ConversationRef): Flow<ConversationPage>
    suspend fun loadEarlier(ref: ConversationRef, cursorId: String): ConversationPage
    suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String
    suspend fun markRead(ref: ConversationRef, messageIds: List<String>)
}

class MessageSendException(val definitelyRejected: Boolean, cause: Throwable) :
    IllegalStateException("Envoi du message non confirmé.", cause)

class UnconfiguredConversationGateway : ConversationGateway {
    private fun unavailable(): Nothing = throw ProviderConfigurationException("La messagerie est indisponible.")
    override fun observeInboxChanges(): Flow<Unit> = flow { unavailable() }
    override suspend fun loadConversations(cursor: String?): ConversationDirectoryPage = unavailable()
    override suspend fun loadBookingOptions(cursor: String?): ConversationBookingPage = unavailable()
    override fun observeConversation(ref: ConversationRef): Flow<ConversationPage> = flow { unavailable() }
    override suspend fun loadEarlier(ref: ConversationRef, cursorId: String): ConversationPage = unavailable()
    override suspend fun sendMessage(ref: ConversationRef, body: String, requestId: String): String = unavailable()
    override suspend fun markRead(ref: ConversationRef, messageIds: List<String>): Unit = unavailable()
}
