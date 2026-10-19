package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class EmergencyContactState(private val uid: String, private val gateway: EmergencyContactGateway,
    initialTarget: EmergencyContactTarget, private val requestId: () -> String = { UUID.randomUUID().toString() }) {
    var target by mutableStateOf(initialTarget); private set
    var view by mutableStateOf<EmergencyContactView?>(null); private set
    var name by mutableStateOf(""); private set
    var phone by mutableStateOf(""); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var generation = 0L
    private var closed = false
    val candidate get() = runCatching { PersonalEmergencyContact(name.trim(), phone) }.getOrNull()
    val dirty get() = name != (view?.contact?.name ?: "") || phone != (view?.contact?.phone ?: "")
    val canSave get() = !closed && !busy && view != null && candidate != null && dirty
    val canDial get() = !closed && !busy && view?.contact != null && !dirty
    fun editName(value: String) { if (!closed && !busy && view != null && value.length <= 100) { name = value; notice = null } }
    fun editPhone(value: String) { if (!closed && !busy && view != null && value.length <= 16) { phone = value; notice = null } }

    suspend fun select(next: EmergencyContactTarget) {
        if (closed || busy) return
        target = next; clearPrivate(); refresh()
    }
    suspend fun refresh() {
        if (closed || busy) return
        val ticket = ++generation; clearPrivate(); busy = true
        try { accept(gateway.readEmergencyContact(uid, target), ticket) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = "Impossible de lire ce contact. Actualisez." }
        finally { if (current(ticket)) busy = false }
    }
    suspend fun save() { if (canSave) write(requireNotNull(view), requireNotNull(candidate)) }
    suspend fun remove(expected: EmergencyContactView) {
        if (expected.contact != null) write(expected, null)
    }
    private suspend fun write(expected: EmergencyContactView, contact: PersonalEmergencyContact?) {
        if (closed || busy || expected !== view || expected.ownerUid != uid || expected.target != target ||
            contact != null && contact != candidate) return
        val ticket = ++generation; clearPrivate(); busy = true
        var acknowledged = false
        try {
            val receipt = gateway.saveEmergencyContact(uid, EmergencyContactOperation(target, contact, expected.revision, requestId()))
            currentCoroutineContext().ensureActive(); if (!current(ticket)) return
            check(receipt.revision > expected.revision); acknowledged = true
            val latest = gateway.readEmergencyContact(uid, target)
            check(latest.revision >= receipt.revision)
            accept(latest, ticket)
            if (current(ticket)) notice = if (contact == null) "Contact supprimé." else "Contact enregistré."
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = if (acknowledged)
            "Modification enregistrée. Actualisez pour relire le contact." else "Modification non confirmée. Actualisez avant de réessayer."
        } finally { if (current(ticket)) busy = false }
    }
    suspend fun dial(launch: (PersonalEmergencyContact) -> EmergencyDialerResult) {
        val expected = view ?: return
        if (!canDial) return
        val ticket = ++generation; clearPrivate(); busy = true
        try {
            val latest = gateway.readEmergencyContact(uid, target); accept(latest, ticket)
            if (!current(ticket)) return
            if (latest.revision != expected.revision || latest.contact != expected.contact) {
                notice = "Le contact a changé. Vérifiez-le avant d’ouvrir le téléphone."; return
            }
            val launched = launch(requireNotNull(latest.contact)); if (!current(ticket)) return
            when (launched) {
                EmergencyDialerResult.Opened -> notice = "Téléphone ouvert."
                EmergencyDialerResult.Unavailable -> error = "Aucune application téléphone disponible."
                EmergencyDialerResult.Denied -> error = "Impossible d’ouvrir le téléphone."
                EmergencyDialerResult.Cancelled -> notice = "Ouverture annulée."
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) { clearPrivate(); error = "Impossible de vérifier le contact. Actualisez." } }
        finally { if (current(ticket)) busy = false }
    }
    private suspend fun accept(result: EmergencyContactView, ticket: Long) {
        currentCoroutineContext().ensureActive()
        check(result.ownerUid == uid && result.target == target && result.revision in 0..9_007_199_254_740_991L &&
            (result.contact == null || result.revision > 0))
        if (result.target is EmergencyContactTarget.Child) check(!result.childName.isNullOrBlank() && !result.clubName.isNullOrBlank())
        if (!current(ticket)) return
        view = result; name = result.contact?.name ?: ""; phone = result.contact?.phone ?: ""
    }
    private fun current(ticket: Long) = !closed && generation == ticket
    private fun clearPrivate() { view = null; name = ""; phone = ""; error = null; notice = null }
    fun leaveForeground() { generation++; clearPrivate(); busy = false }
    fun close() { closed = true; leaveForeground() }
}
