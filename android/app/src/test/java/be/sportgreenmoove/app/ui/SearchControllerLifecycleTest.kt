package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class SearchControllerLifecycleTest {
    @Test fun closeClearsCachedPlacesResultsAndSearchStatus() {
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("trip"))
        }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form)
            assertEquals(1, test.state.matches.size)
            assertTrue(test.state.hasSearched)
            test.state.close()
            assertNull(test.state.origin)
            assertNull(test.state.destination)
            assertTrue(test.state.matches.isEmpty())
            assertTrue(test.state.originSuggestions.isEmpty() && test.state.destinationSuggestions.isEmpty())
            assertFalse(test.state.loading || test.state.hasSearched)
            test.state.close()
        }
    }

    @Test fun closeRejectsAResolutionThatIgnoresCancellation() = runBlocking {
        val response = CompletableDeferred<ResolvedPlace>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun resolvePlace(placeId: String) = withContext(NonCancellable) { response.await() }
        }
        SearchTestSession(gateway).use { test ->
            test.state.selectPlace(suggestion("old"), SearchPlaceTarget.Origin)
            test.state.close()
            response.complete(place("old"))
            assertNull(test.state.origin)
            assertTrue(test.errors.isEmpty())
            assertFalse(test.state.loading)
        }
    }

    @Test fun changingAPlaceInvalidatesItsCoordinatesAndPendingMatches() = runBlocking {
        val response = CompletableDeferred<List<be.sportgreenmoove.app.data.TripMatchSummary>>()
        var searches = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<be.sportgreenmoove.app.data.TripMatchSummary> {
                searches += 1
                return withContext(NonCancellable) { response.await() }
            }
        }
        SearchTestSession(gateway).use { test ->
            selectBoth(test.state)
            submitSearchForm(test.state, form)
            test.state.editPlace(SearchPlaceTarget.Origin)
            response.complete(listOf(match("old-coordinates")))
            assertNull(test.state.origin)
            assertTrue(test.state.matches.isEmpty())
            assertFalse(test.state.hasSearched || test.state.loading)
            submitSearchForm(test.state, form)
            assertEquals(1, searches)
            assertEquals("Choisissez un départ et une destination dans les suggestions.", test.errors.last())
        }
    }

    @Test fun loadingRemainsTrueUntilBothPlaceRequestsFinish() = runBlocking {
        val origin = CompletableDeferred<List<PlaceSuggestion>>()
        val destination = CompletableDeferred<List<PlaceSuggestion>>()
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun suggestPlaces(input: String) = if (input == "origin") origin.await() else destination.await()
        }
        SearchTestSession(gateway).use { test ->
            test.state.suggestPlaces("origin", SearchPlaceTarget.Origin)
            test.state.suggestPlaces("destination", SearchPlaceTarget.Destination)
            origin.complete(listOf(suggestion("origin")))
            assertTrue(test.state.loading)
            destination.complete(listOf(suggestion("destination")))
            assertFalse(test.state.loading)
            assertEquals(1, test.state.originSuggestions.size)
            assertEquals(1, test.state.destinationSuggestions.size)
        }
    }

    @Test fun anActiveFailureIsReportedWithoutInventingAPlace() {
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun resolvePlace(placeId: String): ResolvedPlace = error("network unavailable")
        }
        SearchTestSession(gateway).use { test ->
            test.state.selectPlace(suggestion("origin"), SearchPlaceTarget.Origin)
            assertNull(test.state.origin)
            assertFalse(test.state.loading)
            assertEquals(listOf("Connexion réseau indisponible. Vérifiez votre connexion puis réessayez."), test.errors)
        }
    }

    @Test fun aClosedControllerCannotDispatchAnyOldHandler() {
        var calls = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun suggestPlaces(input: String): List<PlaceSuggestion> { calls++; return emptyList() }
            override suspend fun resolvePlace(placeId: String): ResolvedPlace { calls++; return place(placeId) }
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int): String { calls++; return "booking" }
        }
        SearchTestSession(gateway).use { test ->
            test.state.close()
            test.state.suggestPlaces("place", SearchPlaceTarget.Origin)
            test.state.selectPlace(suggestion("place"), SearchPlaceTarget.Origin)
            submitSearchForm(test.state, form)
            test.state.requestMatch(match("trip"))
            assertEquals(0, calls)
            assertTrue(test.errors.isEmpty() && test.notices.isEmpty() && test.appLoading.isEmpty())
        }
    }
}

internal class SearchTestSession(gateway: FirebaseGateway) : AutoCloseable {
    val errors = mutableListOf<String>()
    val notices = mutableListOf<String>()
    val appLoading = mutableListOf<Boolean>()
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    val state = SearchController(AndroidProviderSet(UnconfiguredAuthGateway(), gateway), scope,
        { if (it != null) errors += it }, { notices += it }, { appLoading += it })
    override fun close() { state.close(); scope.cancel() }
}
