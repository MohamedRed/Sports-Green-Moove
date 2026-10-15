package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.NativeLedgerSummaries
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.AndroidProviderSet

internal class AppDataState {
    val trips = mutableStateOf(emptyList<TripSummary>())
    val children = mutableStateOf(emptyList<ChildSummary>())
    val clubs = mutableStateOf(emptyList<ClubSummary>())
    val activeRide = mutableStateOf<LiveRideSnapshot?>(null)
    val activeRideTrip = mutableStateOf<TripSummary?>(null)
    val payableBookings = mutableStateOf(emptyList<PayableBookingSummary>())
    val driverBookingRequests = mutableStateOf(emptyList<BookingRequestSummary>())
    val ledgerSummaries = mutableStateOf(NativeLedgerSummaries())

    suspend fun refresh(providers: AndroidProviderSet, role: AppRole) {
        trips.value = providers.firebase.searchTrips()
        children.value = if (role == AppRole.Parent) providers.firebase.listChildren() else emptyList()
        clubs.value = providers.firebase.listClubSummaries()
        activeRide.value = providers.firebase.getActiveRide()
        activeRideTrip.value = activeRide.value?.tripId?.let { tripId ->
            activeRideTrip.value?.takeIf { it.id == tripId } ?: trips.value.firstOrNull { it.id == tripId }
        }
        payableBookings.value = providers.firebase.getPayableBookings()
        ledgerSummaries.value = NativeLedgerSummaries(
            impact = providers.firebase.getImpactSummary(),
            rewards = providers.firebase.getRewardSummary(),
        )
        driverBookingRequests.value = if (role == AppRole.Driver) providers.firebase.getDriverBookingRequests() else emptyList()
    }

    fun clear() {
        trips.value = emptyList()
        children.value = emptyList()
        clubs.value = emptyList()
        activeRide.value = null
        activeRideTrip.value = null
        payableBookings.value = emptyList()
        driverBookingRequests.value = emptyList()
        ledgerSummaries.value = NativeLedgerSummaries()
    }
}
