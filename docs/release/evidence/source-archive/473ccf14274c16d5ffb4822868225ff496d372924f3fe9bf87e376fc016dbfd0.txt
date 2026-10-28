package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.SupportSubmission
import be.sportgreenmoove.app.services.SupportSubmissionStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class SupportSubmissionState(private val uid: String, private val store: SupportSubmissionStore,
    private val submitter: suspend (SupportSubmission) -> String) {
    var reason by mutableStateOf("Sécurité"); private set
    var description by mutableStateOf(""); private set
    var emergency by mutableStateOf(false); private set
    var pending by mutableStateOf<SupportSubmission?>(null); private set
    var busy by mutableStateOf(false); private set
    var ready by mutableStateOf(false); private set
    var message by mutableStateOf<String?>(null); private set
    private var closed = false
    val editable get() = ready && !busy && pending == null && !closed
    init { restore() }
    fun reason(value: String) { if (editable) reason = value }
    fun description(value: String) { if (editable) description = value }
    fun emergency(value: Boolean) { if (editable) emergency = value }
    fun restore() {
        if (closed || busy) return
        ready = false
        try {
            pending = store.read(uid)
            pending?.let { reason = it.reason; description = it.description; emergency = it.emergency }
            ready = true
            message = if (pending != null) "Envoi non confirmé. Réessayez pour vérifier cette demande." else null
        } catch (_: Exception) { message = "Impossible de retrouver l’envoi en attente. Réessayez." }
    }
    suspend fun submit() {
        if (closed || busy || !ready) return
        if (pending == null && (reason.trim().length !in 2..120 || description.trim().length !in 5..2000)) {
            message = "Ajoutez une raison et une description précise."; return
        }
        busy = true; message = null
        try {
            val operation = pending ?: SupportSubmission(uid, UUID.randomUUID().toString(), reason.trim(), description.trim(), emergency)
            pending = store.begin(operation)
            val id = submitter(operation)
            currentCoroutineContext().ensureActive()
            if (closed) return
            check(id.isNotBlank())
            store.acknowledge(uid, operation.requestId)
            pending = null; description = ""; emergency = false
            message = "Signalement envoyé: $id"
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            if (!closed) {
                ready = false
                restoreAfterFailure()
            }
        } finally { if (!closed) busy = false }
    }
    private fun restoreAfterFailure() {
        try {
            pending = store.read(uid)
            pending?.let { reason = it.reason; description = it.description; emergency = it.emergency }
            ready = true
        }
        catch (_: Exception) { ready = false }
        message = if (pending != null) "Envoi non confirmé. Réessayez pour vérifier cette demande."
            else "Envoi non confirmé. Réessayez avant de quitter cet écran."
    }
    fun close() { closed = true; ready = false; pending = null; reason = "Sécurité"; description = ""; emergency = false; message = null }
}
