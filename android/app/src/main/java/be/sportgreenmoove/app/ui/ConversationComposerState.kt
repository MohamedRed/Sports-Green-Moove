package be.sportgreenmoove.app.ui

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.MessageSendException
import kotlinx.coroutines.CancellationException
import java.util.UUID

internal class ConversationComposerState(
    draftState: MutableState<String> = mutableStateOf(""),
    pendingState: MutableState<String?> = mutableStateOf(null),
) {
    var draft by draftState
        private set
    var pendingId by pendingState
        private set
    var sending by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    val locked: Boolean get() = pendingId != null

    fun edit(value: String) {
        if (sending || locked) return
        draft = value
        error = null
    }

    fun acknowledge(requestId: String) {
        if (pendingId != requestId) return
        draft = ""
        pendingId = null
        error = null
    }

    suspend fun send(ref: ConversationRef, gateway: ConversationGateway, acknowledged: (String) -> Boolean) {
        sendOperation({ body, requestId -> gateway.sendMessage(ref, body, requestId) }, acknowledged)
    }

    suspend fun sendOperation(send: suspend (String, String) -> String, acknowledged: (String) -> Boolean) {
        val body = draft.trim()
        if (sending || body.isBlank() || body.length > 1000) return
        val retryingUnconfirmed = pendingId != null
        val requestId = pendingId ?: UUID.randomUUID().toString()
        pendingId = requestId
        sending = true
        error = null
        try {
            send(body, requestId)
            acknowledge(requestId)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) {
            when {
                pendingId != requestId -> Unit
                acknowledged(requestId) -> acknowledge(requestId)
                // A rejected retry cannot rule out a commit by an earlier uncertain attempt.
                failure is MessageSendException && failure.definitelyRejected && !retryingUnconfirmed -> {
                    pendingId = null
                    error = "Envoi refusé. Vérifiez le message et réessayez."
                }
                else -> error = "Envoi non confirmé. Réessayez."
            }
        } finally { sending = false }
    }
}
