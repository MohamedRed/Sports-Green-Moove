package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.ReservationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

@MainThread
internal class ReservationState(private val gateway: ReservationGateway, private val role: AppRole) {
    var items by mutableStateOf(emptyList<ReservationItem>()); private set
    var loading by mutableStateOf(false); private set
    var loadingMore by mutableStateOf(false); private set
    var acting by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var notice by mutableStateOf<String?>(null); private set
    var hasMore by mutableStateOf(false); private set
    var requiresReload by mutableStateOf(false); private set
    private var cursor: String? = null
    private var generation = 0L
    private var closed = false
    private fun current(ticket: Long) = !closed && ticket == generation

    suspend fun reload(onChanged: suspend () -> Unit = {}) {
        if (closed || loading || acting) return
        val ticket = ++generation
        loading = true
        loadingMore = false
        error = null
        notice = null
        try {
            val page = gateway.list(role)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            items = page.items; cursor = page.nextCursor; hasMore = cursor != null
            onChanged()
            if (current(ticket)) requiresReload = false
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (current(ticket)) { error = UserFacingErrorPolicy.messageFor(failure); requiresReload = true } }
        finally { if (current(ticket)) loading = false }
    }

    suspend fun more() {
        val before = cursor ?: return
        if (closed || loading || loadingMore || acting || requiresReload) return
        val ticket = generation
        loadingMore = true
        error = null
        try {
            val page = gateway.list(role, before)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            check(page.nextCursor != before) { "La liste n'a pas avancé. Actualisez les réservations." }
            items = (items + page.items).distinctBy { it.booking.bookingId }
            cursor = page.nextCursor
            hasMore = cursor != null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { if (current(ticket)) error = UserFacingErrorPolicy.messageFor(failure) }
        finally { if (current(ticket)) loadingMore = false }
    }

    suspend fun decide(item: ReservationItem, decision: ReservationDecision, onChanged: suspend () -> Unit) {
        if (closed || acting || loading || loadingMore) return
        if (requiresReload || item !in items || decision !in item.allowedActions) {
            error = "Actualisez les réservations avant de choisir cette action."
            return
        }
        val ticket = ++generation
        acting = true
        error = null
        notice = null
        try {
            gateway.decide(item.booking.bookingId, decision)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            notice = when (decision) {
                ReservationDecision.Approve -> "Demande approuvée."
                ReservationDecision.Decline -> "Demande refusée."
                ReservationDecision.Cancel -> "Réservation annulée."
            }
            items = emptyList()
            cursor = null
            hasMore = false
            val page = gateway.list(role)
            currentCoroutineContext().ensureActive()
            if (!current(ticket)) return
            items = page.items
            cursor = page.nextCursor
            hasMore = cursor != null
            onChanged()
        } catch (cancelled: CancellationException) {
            if (current(ticket)) requiresReload = true
            throw cancelled
        }
        catch (failure: Exception) {
            if (current(ticket)) {
                requiresReload = true
                error = if (notice != null) "Décision enregistrée. Actualisez pour revoir la liste."
                    else "Décision non confirmée. Actualisez la liste avant de réessayer."
            }
        } finally { if (current(ticket)) acting = false }
    }

    fun close() {
        closed = true
        generation++
        items = emptyList()
        cursor = null
        hasMore = false
        requiresReload = false
        loading = false
        loadingMore = false
        acting = false
        error = null
        notice = null
    }
}
