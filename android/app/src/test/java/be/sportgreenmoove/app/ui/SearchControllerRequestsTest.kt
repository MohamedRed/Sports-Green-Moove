package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchControllerRequestsTest {
    @Test fun olderSuggestionsCannotReplaceTheLatestRequest() = runBlocking {
        val old = CompletableDeferred<List<PlaceSuggestion>>()
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun suggestPlaces(input: String) = if (input == "old") old.await() else listOf(suggestion("new"))
        }
        fixture(gateway) { state ->
            state.suggestPlaces("old", SearchPlaceTarget.Origin)
            state.suggestPlaces("new", SearchPlaceTarget.Origin)
            old.complete(listOf(suggestion("old")))
            assertEquals(listOf("new"), state.originSuggestions.map { it.placeId })
        }
    }

    @Test fun olderResolvedPlaceCannotReplaceANewerSelection() = runBlocking {
        val old = CompletableDeferred<ResolvedPlace>()
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun resolvePlace(placeId: String) = if (placeId == "old") old.await() else place("new")
        }
        fixture(gateway) { state ->
            state.selectPlace(suggestion("old"), SearchPlaceTarget.Origin)
            state.selectPlace(suggestion("new"), SearchPlaceTarget.Origin)
            old.complete(place("old"))
            assertEquals("new", state.origin?.placeId)
        }
    }

    @Test fun olderSearchCannotReplaceNewerMatches() = runBlocking {
        val old = CompletableDeferred<List<TripMatchSummary>>()
        var calls = 0
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<TripMatchSummary> =
                if (++calls == 1) old.await() else listOf(match("new"))
        }
        fixture(gateway) { state ->
            selectBoth(state)
            submitSearchForm(state, form)
            submitSearchForm(state, form.copy(seatsNeeded = 2))
            old.complete(listOf(match("old")))
            assertEquals(listOf("new"), state.matches.map { it.tripId })
        }
    }

    @Test fun cancelledBookingCannotPublishAnErrorOrLoadingCallback() = runBlocking {
        val response = CompletableDeferred<String>()
        var bookingStarted = false
        val gateway = object : FirebaseGateway by placesGateway() {
            override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(match("trip"))
            override suspend fun requestBooking(tripId: String, childId: String?, seats: Int): String {
                bookingStarted = true
                return response.await()
            }
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val callbacks = mutableListOf<String>()
        val state = SearchController(AndroidProviderSet(UnconfiguredAuthGateway(), gateway), scope,
            { if (it != null) callbacks += "error" }, { callbacks += "notice" }, { callbacks += "loading:$it" })
        try {
            selectBoth(state)
            submitSearchForm(state, form)
            state.requestMatch(state.matches.single())
            assertTrue(bookingStarted)
            callbacks.clear()
            scope.cancel()
            assertTrue("Cancelled work must not update another session", callbacks.isEmpty())
        } finally { scope.cancel() }
    }
}

internal val form = SearchFormState("2026-10-17T12:00:00Z", 1, "medium", false, false, true, null)
internal fun submitSearchForm(state: SearchController, requested: SearchFormState) {
    state.updateForm(requested)
    if (requested.guardianConsent) state.updateForm(state.form.copy(guardianConsent = true))
    state.runSearch()
}
internal fun suggestion(id: String) = PlaceSuggestion(id, id, id, null)
internal fun place(id: String) = ResolvedPlace(id, id, "Adresse QA $id", 50.7, 4.6)
internal fun placesGateway() = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
    override suspend fun resolvePlace(placeId: String) = place(placeId)
}
internal fun selectBoth(state: SearchController) {
    state.selectPlace(suggestion("origin"), SearchPlaceTarget.Origin)
    state.selectPlace(suggestion("destination"), SearchPlaceTarget.Destination)
}
internal fun match(id: String) = TripMatchSummary(id, 1.0,
    TripSummary(id = id, title = id, club = "Club QA", category = "U8 QA", departureLabel = "17 octobre",
        dateLabel = "17 octobre", timeLabel = "12:00", distanceLabel = "1 km", seatsAvailable = 2,
        priceLabel = "Gratuit", reasons = emptyList()),
    emptyList(), null, null)
internal fun fixture(gateway: FirebaseGateway, test: (SearchController) -> Unit) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    try {
        test(SearchController(AndroidProviderSet(UnconfiguredAuthGateway(), gateway), scope, {}, {}, {}))
    } finally { scope.cancel() }
}
