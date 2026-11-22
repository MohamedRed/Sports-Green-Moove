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
    private val persist: ((String, String?) -> Unit)? = null,
) {
    var draft by draftState
        private set
    var pendingId by pendingState
        private set
    var sending by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(if (pendingState.value != null) "Envoi non confirmé. Réessayez." else null)
        private set
    val locked: Boolean get() = pendingId != null

    fun edit(value: String) {
        if (sending || locked) return
        draft = value
        error = null
        save(value, null)
    }

    fun acknowledge(requestId: String) {
        if (pendingId != requestId) return
        if (!save("", null)) return
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
        if (!save(draft, requestId)) return
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
                    if (save(draft, null)) {
                        pendingId = null
                        error = "Envoi refusé. Vérifiez le message et réessayez."
                    }
                }
                else -> error = "Envoi non confirmé. Réessayez."
            }
        } finally { sending = false }
    }

    private fun save(body: String, requestId: String?): Boolean {
        return try { persist?.invoke(body, requestId); true }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            error = "Impossible de conserver le brouillon. Réessayez."
            false
        }
    }
}
