package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.EmergencyContactGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal class ChildRideEmergencyState(private val uid: String, private val rideId: String, private val gateway: EmergencyContactGateway) {
    var view by mutableStateOf<ChildRideEmergencyContactView?>(null); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var generation = 0L
    private var closed = false
    val canDial get() = !closed && !busy && view?.contact != null
    suspend fun refresh() {
        if (closed || busy) return
        val ticket = ++generation; clear(); busy = true
        try { accept(gateway.readChildRideEmergencyContact(uid, rideId), ticket) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) error = "Contact indisponible. Actualisez." }
        finally { if (current(ticket)) busy = false }
    }
    suspend fun dial(launch: (PersonalEmergencyContact) -> EmergencyDialerResult) {
        val expected = view ?: return
        if (!canDial) return
        val ticket = ++generation; clear(); busy = true
        try {
            val latest = gateway.readChildRideEmergencyContact(uid, rideId); accept(latest, ticket)
            if (!current(ticket)) return
            if (latest.childId != expected.childId || latest.contact != expected.contact || latest.revision != expected.revision || latest.childInstanceId != expected.childInstanceId) {
                notice = "Le contact a changé. Vérifiez-le avant d’ouvrir le téléphone."; return
            }
            when (launch(requireNotNull(latest.contact))) {
                EmergencyDialerResult.Opened -> if (current(ticket)) notice = "Téléphone ouvert."
                EmergencyDialerResult.Unavailable -> if (current(ticket)) error = "Aucune application téléphone disponible."
                EmergencyDialerResult.Denied -> if (current(ticket)) error = "Impossible d’ouvrir le téléphone."
                EmergencyDialerResult.Cancelled -> if (current(ticket)) notice = "Ouverture annulée."
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (current(ticket)) { clear(); error = "Impossible de vérifier le contact. Actualisez." } }
        finally { if (current(ticket)) busy = false }
    }
    private suspend fun accept(value: ChildRideEmergencyContactView, ticket: Long) {
        currentCoroutineContext().ensureActive()
        check(value.ownerUid == uid && value.childId.isNotBlank() && !value.childId.contains('/') && value.rideSessionId == rideId &&
            value.childInstanceId.matches(Regex("[a-f0-9]{64}")) && value.childName.isNotBlank() &&
            value.revision in 0..9_007_199_254_740_991L && (value.contact == null || value.revision > 0))
        if (current(ticket)) view = value
    }
    private fun current(ticket: Long) = !closed && generation == ticket
    private fun clear() { view = null; error = null; notice = null }
    fun leaveForeground() { generation++; clear(); busy = false }
    fun close() { closed = true; leaveForeground() }
}
