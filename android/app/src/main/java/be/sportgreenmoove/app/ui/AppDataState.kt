package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.snapshots.Snapshot
import androidx.annotation.MainThread
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.NativeLedgerSummaries
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.AndroidProviderSet

@MainThread
internal class AppDataState {
    private var generation = 0L
    private var clubsGeneration = 0L
    private class SupersededRefresh : RuntimeException()
    val trips = mutableStateOf(emptyList<TripSummary>())
    val children = mutableStateOf(emptyList<ChildSummary>())
    val clubs = mutableStateOf(emptyList<ClubSummary>())
    val activeRide = mutableStateOf<LiveRideSnapshot?>(null)
    val activeRideTrip = mutableStateOf<TripSummary?>(null)
    val payableBookings = mutableStateOf(emptyList<PayableBookingSummary>())
    val driverBookingRequests = mutableStateOf(emptyList<BookingRequestSummary>())
    val ledgerSummaries = mutableStateOf(NativeLedgerSummaries())

    suspend fun refresh(providers: AndroidProviderSet, role: AppRole) {
        val request = ++generation
        suspend fun <T> load(action: suspend () -> T): T {
            val result = action()
            if (request != generation) throw SupersededRefresh()
            return result
        }
        try {
            val nextTrips = load { providers.firebase.searchTrips() }
            val nextChildren = if (role == AppRole.Parent) load { providers.firebase.listChildren() } else emptyList()
            val clubsRequest = clubsGeneration
            val nextClubs = load { providers.firebase.listClubSummaries() }
            val nextRide = load { providers.firebase.getActiveRide() }
            val nextPayable = load { providers.firebase.getPayableBookings() }
            val nextLedgers = NativeLedgerSummaries(
                impact = load { providers.firebase.getImpactSummary() },
                rewards = load { providers.firebase.getRewardSummary() },
            )
            val nextRequests = if (role == AppRole.Driver) load { providers.firebase.getDriverBookingRequests() } else emptyList()
            Snapshot.withMutableSnapshot {
                trips.value = nextTrips
                children.value = nextChildren
                if (clubsRequest == clubsGeneration) clubs.value = nextClubs
                activeRide.value = nextRide
                activeRideTrip.value = nextRide?.tripId?.let { id ->
                    activeRideTrip.value?.takeIf { it.id == id } ?: nextTrips.firstOrNull { it.id == id }
                }
                payableBookings.value = nextPayable
                ledgerSummaries.value = nextLedgers
                driverBookingRequests.value = nextRequests
            }
        } catch (_: SupersededRefresh) {
            // A newer refresh or logout owns the state now.
        } catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (failure: Exception) { if (request == generation) throw failure }
    }

    fun replaceClubs(value: List<ClubSummary>) { clubsGeneration += 1; clubs.value = value }

    fun clear() {
        generation += 1
        clubsGeneration += 1
        Snapshot.withMutableSnapshot {
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
}
