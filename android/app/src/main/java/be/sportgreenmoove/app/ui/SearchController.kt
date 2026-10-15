package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope

@MainThread
class SearchController(
    private val providers: AndroidProviderSet,
    scope: CoroutineScope,
    private val onError: (String?) -> Unit,
    private val onNotice: (String) -> Unit,
    onAppLoading: (Boolean) -> Unit,
) {
    var origin by mutableStateOf<ResolvedPlace?>(null)
        private set
    var destination by mutableStateOf<ResolvedPlace?>(null)
        private set
    var originSuggestions by mutableStateOf(emptyList<PlaceSuggestion>())
        private set
    var destinationSuggestions by mutableStateOf(emptyList<PlaceSuggestion>())
        private set
    var matches by mutableStateOf(emptyList<TripMatchSummary>())
        private set
    var loading by mutableStateOf(false)
        private set
    var hasSearched by mutableStateOf(false)
        private set
    private val requests = SearchRequests(scope, onError, { loading = it }, onAppLoading)

    fun editPlace(target: SearchPlaceTarget) {
        if (!requests.isActive) return
        requests.invalidate(target.request())
        if (target == SearchPlaceTarget.Origin) { origin = null; originSuggestions = emptyList() }
        else { destination = null; destinationSuggestions = emptyList() }
        invalidateMatches()
    }

    fun suggestPlaces(input: String, target: SearchPlaceTarget) {
        if (!requests.isActive) return
        editPlace(target)
        requests.launch(target.request(), { providers.firebase.suggestPlaces(input) }) {
            if (target == SearchPlaceTarget.Origin) originSuggestions = it else destinationSuggestions = it
        }
    }

    fun selectPlace(suggestion: PlaceSuggestion, target: SearchPlaceTarget) {
        if (!requests.isActive) return
        editPlace(target)
        requests.launch(target.request(), { providers.firebase.resolvePlace(suggestion.placeId) }) {
            if (target == SearchPlaceTarget.Origin) origin = it else destination = it
        }
    }

    fun runSearch(form: SearchFormState) {
        if (!requests.isActive) return
        invalidateMatches()
        val selectedOrigin = origin
        val selectedDestination = destination
        if (selectedOrigin == null || selectedDestination == null) {
            onError("Choisissez un départ et une destination dans les suggestions.")
            return
        }
        if (form.requireChildTracking && form.childUserId.isNullOrBlank()) {
            onError("Choisissez un enfant pour activer le suivi enfant.")
            return
        }
        if (form.requireChildTracking && !form.guardianConsent) {
            onError("Votre consentement est nécessaire pour activer le suivi enfant.")
            return
        }
        requests.launch(SearchRequest.Matches, {
            providers.firebase.searchTripMatches(TripSearchCriteria(selectedOrigin, selectedDestination,
                form.desiredDepartureAtIso, form.seatsNeeded, form.baggage, form.returnTrip,
                form.requireChildTracking, form.guardianConsent, form.childUserId))
        }) { matches = it; hasSearched = true }
    }

    fun requestMatch(match: TripMatchSummary, childUserId: String?) {
        requests.launch(SearchRequest.Booking, { providers.firebase.requestBooking(match.tripId, childUserId) }) {
            onNotice("Demande envoyée.")
        }
    }

    fun close() {
        requests.close()
        origin = null
        destination = null
        originSuggestions = emptyList()
        destinationSuggestions = emptyList()
        matches = emptyList()
        loading = false
        hasSearched = false
    }

    private fun invalidateMatches() {
        requests.invalidate(SearchRequest.Matches)
        matches = emptyList()
        hasSearched = false
    }
    private fun SearchPlaceTarget.request() = if (this == SearchPlaceTarget.Origin) SearchRequest.Origin else SearchRequest.Destination
}
