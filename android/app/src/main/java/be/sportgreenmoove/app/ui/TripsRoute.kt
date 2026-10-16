package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.FirebaseGateway

data class TripManagementActions(val uid: String, val role: AppRole, val activeTripId: String?, val onCancel: (TripSummary) -> Unit) {
    fun canCancel(trip: TripSummary) = role == AppRole.Driver && uid == trip.driverUserId &&
        trip.status == TripStatus.Upcoming && !trip.cancelled && activeTripId != trip.id
}

@Composable
internal fun TripsRoute(
    uid: String, role: AppRole, gateway: FirebaseGateway,
    trips: List<TripSummary>, activeRide: LiveRideSnapshot?, pendingCount: Int,
    onTripAction: (TripSummary) -> Unit, onOpenSearch: () -> Unit, onOpenRide: () -> Unit,
    onChanged: suspend () -> Unit, reservationContent: @Composable () -> Unit,
) {
    var selected by remember(uid, role, gateway) { mutableStateOf<TripSummary?>(null) }
    TripsScreen(trips, activeRide, pendingCount, onTripAction, onOpenSearch, onOpenRide, reservationContent,
        management = TripManagementActions(uid, role, activeRide?.tripId) { selected = it })
    selected?.let { trip ->
        TripCancellationDialog(uid, role, trip, gateway, onChanged, onDismiss = { selected = null })
    }
}
