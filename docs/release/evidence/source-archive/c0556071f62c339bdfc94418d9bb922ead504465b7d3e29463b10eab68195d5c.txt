package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.domain.BookingReplyUnconfirmedException
import be.sportgreenmoove.app.domain.BookingReviewRequiredException
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.ReservationGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch

@MainThread
internal class DirectBookingState(
    private val uid: String?, private val firebase: FirebaseGateway, private val reservations: ReservationGateway,
    parent: CoroutineScope, private val currentUid: () -> String?,
) {
    private val lifetime = SupervisorJob(parent.coroutineContext[Job])
    private val scope = CoroutineScope(parent.coroutineContext + lifetime)
    private var version = 0L
    private var work: Job? = null
    var trip by mutableStateOf<TripSummary?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var submitting by mutableStateOf(false)
        private set
    var ready by mutableStateOf(false)
        private set
    var confirmation by mutableStateOf<String?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var replyUnconfirmed by mutableStateOf(false)
        private set
    val canConfirm get() = validAccount() && ready && !loading && !submitting && confirmation == null

    fun open(selected: TripSummary) {
        if (!validAccount() || submitting) return
        trip = selected
        reload()
    }

    fun reload() {
        val selected = trip ?: return
        if (!validAccount() || submitting) return
        val request = ++version
        work?.cancel()
        loading = true; ready = false; confirmation = null; error = null; replyUnconfirmed = false
        work = scope.launch {
            try {
                check(accepts(request))
                val fresh = firebase.searchTrips().singleOrNull { it.id == selected.id }
                    ?: error("Ce trajet n’est plus disponible.")
                check(fresh.status == TripStatus.Upcoming && !fresh.cancelled) { "Ce trajet n’est plus disponible." }
                var cursor: String? = null
                val cursors = mutableSetOf<String>()
                var existing: String? = null
                do {
                    check(accepts(request))
                    val page = reservations.list(AppRole.Parent, cursor)
                    check(page.items.all { it.booking.parentUserId == uid }) { "Reservation account mismatch" }
                    page.items.map { it.booking }.firstOrNull {
                        it.tripId == selected.id && it.childId == null && it.status in setOf("requested", "approved")
                    }?.let { existing = it.status }
                    cursor = page.nextCursor
                    if (cursor != null) check(cursors.add(cursor)) { "Repeated reservation cursor" }
                } while (existing == null && cursor != null)
                currentCoroutineContext().ensureActive()
                if (accepts(request)) {
                    trip = fresh; ready = fresh.seatsAvailable >= 1
                    confirmation = when (existing) {
                        "requested" -> "Votre demande est en attente."
                        "approved" -> "Votre réservation est approuvée."
                        else -> null
                    }
                    if (!ready && confirmation == null) error = "Ce trajet ne propose plus de place."
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { if (accepts(request)) error = UserFacingErrorPolicy.messageFor(failure) }
            finally { if (accepts(request)) loading = false }
        }
    }

    fun confirm() {
        val selected = trip ?: return
        if (!canConfirm) return
        val request = version
        submitting = true; error = null; replyUnconfirmed = false
        work = scope.launch {
            try {
                check(accepts(request))
                check(firebase.requestBooking(selected, null, 1).isNotBlank())
                currentCoroutineContext().ensureActive()
                if (accepts(request)) confirmation = "Demande envoyée."
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                if (accepts(request)) {
                    replyUnconfirmed = failure is BookingReplyUnconfirmedException
                    if (failure is BookingReviewRequiredException) ready = false
                    error = UserFacingErrorPolicy.messageFor(failure)
                }
            } finally { if (accepts(request)) submitting = false }
        }
    }

    fun dismiss() {
        if (submitting) return
        clear()
    }
    fun close() { lifetime.cancel(); clear() }
    private fun clear() {
        version++; work?.cancel(); work = null
        trip = null; loading = false; submitting = false; ready = false
        confirmation = null; error = null; replyUnconfirmed = false
    }
    private fun validAccount() = lifetime.isActive && !uid.isNullOrBlank() && currentUid() == uid
    private fun accepts(request: Long) = validAccount() && version == request
}
