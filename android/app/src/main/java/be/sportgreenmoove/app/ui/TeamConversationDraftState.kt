package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamConversationDraftRecord
import be.sportgreenmoove.app.services.TeamConversationDraftStorage
import kotlinx.coroutines.CancellationException

internal class TeamConversationDraftState(private val uid: String, private val target: TeamConversationTarget,
    private val storage: TeamConversationDraftStorage) {
    var composer by mutableStateOf<ConversationComposerState?>(null); private set
    var error by mutableStateOf<String?>(null); private set

    fun load() {
        if (composer != null) return
        error = null
        try {
            val saved = storage.read(uid, target)
            composer = ConversationComposerState(mutableStateOf(saved?.body.orEmpty()), mutableStateOf(saved?.requestId),
                persist = { body, requestId ->
                    storage.write(uid, target, if (body.isEmpty() && requestId == null) null else TeamConversationDraftRecord(body, requestId))
                })
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { error = "Impossible de restaurer votre brouillon. Réessayez." }
    }
}
