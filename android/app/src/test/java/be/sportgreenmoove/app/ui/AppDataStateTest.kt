package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.cancelAndJoin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppDataStateTest {
    @Test fun logoutInvalidatesAnAlreadyRunningRefresh() = runBlocking {
        val response = CompletableDeferred<List<TripSummary>>()
        val state = AppDataState()
        val pending = launch(start = CoroutineStart.UNDISPATCHED) {
            state.refresh(providers(gateway { response.await() }), AppRole.Parent)
        }
        state.clear()
        response.complete(listOf(trip("previous-account")))
        pending.join()
        assertTrue("A signed-out account must stay cleared", state.trips.value.isEmpty())
        assertTrue(state.children.value.isEmpty())
    }

    @Test fun anOlderResponseCannotReplaceTheNewAccountsRefresh() = runBlocking {
        val response = CompletableDeferred<List<TripSummary>>()
        val state = AppDataState()
        val pending = launch(start = CoroutineStart.UNDISPATCHED) {
            state.refresh(providers(gateway { response.await() }), AppRole.Parent)
        }
        state.clear()
        state.refresh(providers(gateway { listOf(trip("current-account")) }), AppRole.Parent)
        response.complete(listOf(trip("previous-account")))
        pending.join()
        assertEquals(listOf("current-account"), state.trips.value.map { it.id })
    }

    @Test fun aFailedRefreshCannotPublishHalfOfANewSnapshot() = runBlocking {
        val state = AppDataState()
        state.refresh(providers(gateway { listOf(trip("confirmed")) }), AppRole.Parent)
        val incomplete = object : FirebaseGateway by gateway({ listOf(trip("incomplete")) }) {
            override suspend fun listChildren(): List<ChildSummary> = error("Read failed")
        }
        val failure = runCatching { state.refresh(providers(incomplete), AppRole.Parent) }.exceptionOrNull()
        assertEquals("Read failed", failure?.message)
        assertEquals(listOf("confirmed"), state.trips.value.map { it.id })
    }

    @Test fun aFailureFromAnInvalidatedAccountCannotSurfaceInTheNewSession() = runBlocking {
        val response = CompletableDeferred<List<TripSummary>>()
        val state = AppDataState()
        val pending = launch(start = CoroutineStart.UNDISPATCHED) {
            state.refresh(providers(gateway { response.await() }), AppRole.Parent)
        }
        state.clear()
        state.refresh(providers(gateway { listOf(trip("current-account")) }), AppRole.Parent)
        response.completeExceptionally(IllegalStateException("Previous account is no longer authorized"))
        pending.join()
        assertTrue(pending.isCompleted && !pending.isCancelled)
        assertEquals(listOf("current-account"), state.trips.value.map { it.id })
    }

    @Test fun externalCancellationStillCancelsTheRefreshWithoutPublishing() = runBlocking {
        val response = CompletableDeferred<List<TripSummary>>()
        val state = AppDataState()
        val pending = launch(start = CoroutineStart.UNDISPATCHED) {
            state.refresh(providers(gateway { response.await() }), AppRole.Parent)
        }
        pending.cancelAndJoin()
        assertTrue(pending.isCancelled)
        assertTrue(state.trips.value.isEmpty())
    }

    @Test fun aSlowAppSnapshotCannotUndoANewerGroupsRefresh() = runBlocking {
        val ride = CompletableDeferred<LiveRideSnapshot?>()
        val oldClub = ClubSummary("club", "Club QA", "Football", 1, null, "CQ", emptyList(), "requested", false)
        val currentClub = oldClub.copy(roleLabel = "MEMBRE", membershipStatus = "active", membershipActive = true)
        val firebase = object : FirebaseGateway by gateway({ listOf(trip("confirmed")) }) {
            override suspend fun listClubSummaries() = listOf(oldClub)
            override suspend fun getActiveRide(): LiveRideSnapshot? = ride.await()
        }
        val state = AppDataState()
        val refresh = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh(providers(firebase), AppRole.Parent) }
        state.replaceClubs(listOf(currentClub))
        ride.complete(null)
        refresh.join()
        assertEquals(listOf(currentClub), state.clubs.value)
        assertEquals(listOf("confirmed"), state.trips.value.map { it.id })
        state.clear()
        assertTrue(state.clubs.value.isEmpty())
    }

    private fun gateway(trips: suspend () -> List<TripSummary>) = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
        override suspend fun searchTrips() = trips()
        override suspend fun listChildren() = listOf(ChildSummary("child", "Enfant QA", "U8 QA", false))
    }
    private fun providers(firebase: FirebaseGateway) = AndroidProviderSet(UnconfiguredAuthGateway(), firebase)
    private fun trip(id: String) = TripSummary(id = id, title = id, club = "Club QA", category = "U8 QA",
        departureLabel = "17 octobre · 16h00", dateLabel = "17 octobre", timeLabel = "16h00", distanceLabel = "1 km",
        seatsAvailable = 1, priceLabel = "Gratuit", reasons = emptyList())
}
