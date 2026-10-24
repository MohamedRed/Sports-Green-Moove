package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.FirebaseGateway

data class TripManagementActions(
    val uid: String, val role: AppRole, val activeTripId: String?,
    val onEdit: ((TripSummary) -> Unit)? = null, val onReview: ((TripSummary) -> Unit)? = null,
    val onHistory: ((TripSummary) -> Unit)? = null,
    val onCancel: (TripSummary) -> Unit,
) {
    fun canCancel(trip: TripSummary) = role == AppRole.Driver && uid == trip.driverUserId &&
        trip.status == TripStatus.Upcoming && !trip.cancelled && activeTripId != trip.id
    fun canEdit(trip: TripSummary) = canCancel(trip) && trip.pendingChangeId == null
    fun canReview(trip: TripSummary) = role == AppRole.Driver && uid == trip.driverUserId &&
        (trip.pendingChangeId != null || trip.appliedChangeId != null)
}

@Composable
internal fun TripsRoute(
    uid: String, role: AppRole, gateway: FirebaseGateway,
    trips: List<TripSummary>, activeRide: LiveRideSnapshot?, pendingCount: Int,
    onTripAction: (TripSummary) -> Unit, onOpenSearch: () -> Unit, onOpenRide: () -> Unit,
    onChanged: suspend () -> Unit, reservationContent: @Composable () -> Unit,
) {
    var selected by remember(uid, role, gateway) { mutableStateOf<TripSummary?>(null) }
    var change by remember(uid, role, gateway) { mutableStateOf<Pair<String, Boolean>?>(null) }
    var history by remember(uid, role, gateway) { mutableStateOf<TripSummary?>(null) }
    TripsScreen(trips, activeRide, pendingCount, onTripAction, onOpenSearch, onOpenRide, reservationContent,
        management = TripManagementActions(uid, role, activeRide?.tripId,
            onEdit = { change = it.id to false }, onReview = { change = it.id to true }, onHistory = { history = it }) { selected = it })
    history?.let { trip ->
        TripChangeHistoryDialog(uid, role, trip.id, trip.title, gateway, onChanged, onDismiss = { history = null })
    }
    selected?.let { trip ->
        TripCancellationDialog(uid, role, trip, gateway, onChanged, onDismiss = { selected = null })
    }
    change?.let { (id, reviewing) ->
        trips.singleOrNull { it.id == id }?.let { trip ->
            // A pending proposal discovered after an uncertain response must be reviewed, not resubmitted.
            val proposalId = trip.pendingChangeId ?: trip.appliedChangeId.takeIf { reviewing }
            TripChangeDialog(uid, role, id, trip.title, proposalId, gateway, onChanged, onDismiss = { change = null })
        }
    }
}
