package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test
import kotlin.coroutines.CoroutineContext

class SearchControllerSafetyTest {
    @Test fun repeatedBookingTapsDoNotDispatchConcurrentWrites() = runBlocking {
        var writes = 0
        val response = CompletableDeferred<String>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int): String { writes++; return response.await() }
        }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form.copy(childUserId = "child"))
            val selected = test.state.matches.single()
            test.state.requestMatch(selected)
            test.state.requestMatch(selected)
            assertEquals(1, writes)
            assertEquals(listOf(true), test.appLoading)
            response.complete("booking")
            assertEquals(listOf("Demande envoyée."), test.notices)
            assertEquals(listOf(true, false), test.appLoading)
        }
    }

    @Test fun anOldBookingCompletionCannotClearTheNextSessionsLoadingState() = runBlocking {
        val old = CompletableDeferred<String>()
        val current = CompletableDeferred<String>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("old"), match("current"))
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int) =
                withContext(NonCancellable) { if (trip.id == "old") old.await() else current.await() }
        }
        SearchTestSession(gateway).use { previous ->
            selectBoth(previous.state)
            submitSearchForm(previous.state, form)
            previous.state.requestMatch(previous.state.matches.single { it.tripId == "old" })
            previous.state.close()
            SearchTestSession(gateway).use { next ->
                selectBoth(next.state)
                submitSearchForm(next.state, form)
                next.state.requestMatch(next.state.matches.single { it.tripId == "current" })
                old.complete("old-booking")
                assertEquals(listOf(true), next.appLoading)
                assertEquals(listOf(true), previous.appLoading)
                assertTrue(previous.errors.isEmpty() && previous.notices.isEmpty())
                current.complete("current-booking")
                assertEquals(listOf(true, false), next.appLoading)
                assertEquals(listOf("Demande envoyée."), next.notices)
            }
        }
    }

    @Test fun anInvalidNewFormCancelsThePreviousSearchInsteadOfShowingItsMatches() = runBlocking {
        val response = CompletableDeferred<List<TripMatchSummary>>()
        var searches = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary> {
                searches++
                return withContext(NonCancellable) { response.await() }
            }
        }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form)
            submitSearchForm(test.state, form.copy(requireChildTracking = true))
            response.complete(listOf(match("stale")))
            assertEquals(1, searches)
            assertTrue(test.state.matches.isEmpty())
            assertFalse(test.state.hasSearched || test.state.loading)
            assertEquals(listOf("Choisissez un enfant pour activer le suivi enfant."), test.errors)
            submitSearchForm(test.state, form.copy(requireChildTracking = true, childUserId = "child", guardianConsent = false))
            assertEquals("Votre consentement est nécessaire pour activer le suivi enfant.", test.errors.last())
            assertEquals(1, searches)
        }
    }

    @Test fun aSupersededErrorCannotReplaceTheLatestSuccessfulChoice() = runBlocking {
        val response = CompletableDeferred<be.sportgreenmoove.app.data.ResolvedPlace>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun resolvePlace(placeId: String) = if (placeId == "old")
                withContext(NonCancellable) { response.await() } else place(placeId)
        }
        SearchTestSession(gateway).use { test ->
            test.state.selectPlace(suggestion("old"), SearchPlaceTarget.Origin)
            test.state.selectPlace(suggestion("current"), SearchPlaceTarget.Origin)
            response.completeExceptionally(IllegalStateException("Previous account was denied"))
            assertEquals("current", test.state.origin?.placeId)
            assertTrue(test.errors.isEmpty())
            assertFalse(test.state.loading)
        }
    }

    @Test fun aQueuedBookingCannotStartAfterLogout() {
        val dispatcher = QueuedSearchDispatcher()
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        var writes = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int): String { writes++; return "booking" }
        }
        val state = SearchController(AndroidProviderSet(UnconfiguredAuthGateway(), gateway), scope, {}, {}, {})
        try {
            selectBoth(state)
            dispatcher.runQueued()
            submitSearchForm(state, form.copy(childUserId = "child"))
            dispatcher.runQueued()
            assertEquals(1, state.matches.size)
            state.requestMatch(state.matches.single())
            state.close()
            dispatcher.runQueued()
            assertEquals(0, writes)
        } finally { scope.cancel() }
    }
}

private class QueuedSearchDispatcher : CoroutineDispatcher() {
    private val queue = ArrayDeque<Runnable>()
    override fun dispatch(context: CoroutineContext, block: Runnable) { queue.addLast(block) }
    fun runQueued() { while (queue.isNotEmpty()) queue.removeFirst().run() }
}
