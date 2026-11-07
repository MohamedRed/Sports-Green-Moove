package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.TripCancellationPreview
import be.sportgreenmoove.app.data.TripCancellationReady
import be.sportgreenmoove.app.data.TripCancellationReceipt
import be.sportgreenmoove.app.data.TripCancellationRequest
import be.sportgreenmoove.app.services.TripCancellationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

@MainThread
internal class TripCancellationState(private val tripId: String, private val gateway: TripCancellationGateway) {
    var preview by mutableStateOf<TripCancellationPreview?>(null); private set
    var reason by mutableStateOf(""); private set
    var busy by mutableStateOf(false); private set
    var requiresReload by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    private var intent: TripCancellationRequest? = null
    private var generation = 0L
    private var closed = false
    val confirmed: Boolean get() = preview is TripCancellationReceipt
    val canConfirm: Boolean get() = !closed && !busy && !requiresReload && preview is TripCancellationReady && reason.trim().length in 5..300
    val canEdit: Boolean get() = !closed && !busy && !requiresReload && preview is TripCancellationReady
    private fun current(ticket: Long) = !closed && ticket == generation

    fun editReason(value: String) {
        if (!canEdit || value.length > 300) return
        if (value.trim() != reason.trim()) intent = null
        reason = value
    }

    suspend fun reload(onChanged: suspend () -> Unit) {
        if (closed || busy) return
        val ticket = ++generation
        busy = true
        error = null
        notice = null
        try {
            val result = gateway.previewTripCancellation(tripId)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            check(result.tripId == tripId)
            check(!confirmed || result == preview)
            if (result is TripCancellationReady && intent?.expectedRevision?.let { it != result.revision } == true) {
                intent = null
                notice = "Les réservations ont changé. Vérifiez les nouveaux totaux avant de confirmer."
            }
            preview = result
            requiresReload = false
            if (result is TripCancellationReceipt) refreshConfirmed(ticket, onChanged)
        } catch (cancelled: CancellationException) {
            if (current(ticket)) requiresReload = true
            throw cancelled
        }
        catch (failure: Exception) {
            if (current(ticket)) {
                requiresReload = true
                error = if (confirmed) "Trajet annulé. Actualisez pour revoir la liste."
                    else "Impossible de vérifier ce trajet. Actualisez avant de confirmer."
            }
        } finally { if (current(ticket)) busy = false }
    }

    suspend fun confirm(onChanged: suspend () -> Unit) {
        if (!canConfirm) return
        val ready = preview as TripCancellationReady
        val request = intent ?: TripCancellationRequest(tripId, ready.revision, reason.trim()).also { intent = it }
        val ticket = ++generation
        busy = true
        error = null
        notice = null
        try {
            val receipt = gateway.cancelTrip(request)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            check(receipt.tripId == request.tripId && receipt.requestId == request.requestId &&
                receipt.expectedRevision == request.expectedRevision && receipt.reason == request.reason)
            preview = receipt
            requiresReload = false
            refreshConfirmed(ticket, onChanged)
        } catch (cancelled: CancellationException) {
            if (current(ticket)) requiresReload = true
            throw cancelled
        } catch (failure: Exception) {
            if (current(ticket)) {
                requiresReload = true
                error = if (confirmed) "Trajet annulé. Actualisez pour revoir la liste."
                    else "Annulation non confirmée. Actualisez le trajet avant de réessayer."
            }
        } finally { if (current(ticket)) busy = false }
    }

    private suspend fun refreshConfirmed(ticket: Long, onChanged: suspend () -> Unit) {
        onChanged()
        currentCoroutineContext().ensureActive()
        if (current(ticket)) requiresReload = false
    }

    fun close() {
        closed = true
        generation++
        preview = null
        reason = ""
        intent = null
        error = null
        notice = null
        busy = false
        requiresReload = false
    }
}
