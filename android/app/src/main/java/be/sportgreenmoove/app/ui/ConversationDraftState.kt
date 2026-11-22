package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationDraftRecord
import be.sportgreenmoove.app.services.ConversationDraftStorage
import kotlinx.coroutines.CancellationException

internal class ConversationDraftState(private val uid: String, private val ref: ConversationRef,
    private val storage: ConversationDraftStorage) {
    var composer by mutableStateOf<ConversationComposerState?>(null); private set
    var error by mutableStateOf<String?>(null); private set

    fun load() {
        if (composer != null) return
        error = null
        try {
            val saved = storage.read(uid, ref)
            composer = ConversationComposerState(mutableStateOf(saved?.body.orEmpty()), mutableStateOf(saved?.requestId),
                persist = { body, requestId ->
                    storage.write(uid, ref, if (body.isEmpty() && requestId == null) null else ConversationDraftRecord(body, requestId))
                })
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { error = "Impossible de restaurer votre brouillon. Réessayez." }
    }
}
