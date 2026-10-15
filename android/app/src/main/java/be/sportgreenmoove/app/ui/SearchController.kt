package be.sportgreenmoove.app.ui

import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ChildSummary
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
    var originInput by mutableStateOf("")
        private set
    var destinationInput by mutableStateOf("")
        private set
    var form by mutableStateOf(defaultSearchForm())
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
    private var initializedChild = false
    private var acceptedCriteria: TripSearchCriteria? = null
    private val requests = SearchRequests(scope, onError, { loading = it }, onAppLoading)

    fun updateChildren(children: List<ChildSummary>) {
        if (!requests.isActive) return
        if (!initializedChild && children.isNotEmpty()) {
            initializedChild = true
            updateForm(form.copy(childUserId = children.first().id))
        } else if (form.childUserId != null && children.none { it.id == form.childUserId }) {
            updateForm(form.copy(childUserId = null))
        }
    }

    fun updateForm(next: SearchFormState) {
        if (!requests.isActive) return
        val childChanged = form.childUserId != next.childUserId
        val trackingChanged = form.requireChildTracking != next.requireChildTracking
        val updated = if (childChanged || trackingChanged) next.copy(guardianConsent = false) else next
        if (updated == form) return
        if (childChanged) initializedChild = true
        invalidateMatches()
        form = updated
    }

    fun editPlace(target: SearchPlaceTarget, input: String = if (target == SearchPlaceTarget.Origin) originInput else destinationInput) {
        if (!requests.isActive) return
        requests.invalidate(target.request())
        if (target == SearchPlaceTarget.Origin) { originInput = input; origin = null; originSuggestions = emptyList() }
        else { destinationInput = input; destination = null; destinationSuggestions = emptyList() }
        invalidateMatches()
    }

    fun suggestPlaces(input: String, target: SearchPlaceTarget) {
        if (!requests.isActive) return
        editPlace(target, input)
        requests.launch(target.request(), { providers.firebase.suggestPlaces(input) }) {
            if (target == SearchPlaceTarget.Origin) originSuggestions = it else destinationSuggestions = it
        }
    }

    fun selectPlace(suggestion: PlaceSuggestion, target: SearchPlaceTarget) {
        if (!requests.isActive) return
        editPlace(target)
        requests.launch(target.request(), { providers.firebase.resolvePlace(suggestion.placeId) }) {
            if (target == SearchPlaceTarget.Origin) { origin = it; originInput = it.label }
            else { destination = it; destinationInput = it.label }
        }
    }

    fun runSearch() {
        if (!requests.isActive) return
        invalidateMatches()
        if (origin == null || destination == null) {
            onError("Choisissez un départ et une destination dans les suggestions.")
            return
        }
        form.validationMessage()?.let { onError(it); return }
        val criteria = checkNotNull(currentCriteria())
        requests.launch(SearchRequest.Matches, { providers.firebase.searchTripMatches(criteria) }) {
            acceptedCriteria = criteria
            matches = it
            hasSearched = true
        }
    }

    fun requestMatch(match: TripMatchSummary) {
        if (!requests.isActive) return
        val criteria = acceptedCriteria
        if (!hasSearched || criteria == null || criteria != currentCriteria() || match !in matches) {
            onError("Relancez la recherche avant de demander ce trajet.")
            return
        }
        if (match.summary.seatsAvailable < criteria.seatsNeeded) {
            onError("Ce trajet ne propose plus assez de places. Relancez la recherche.")
            return
        }
        requests.launch(SearchRequest.Booking, {
            providers.firebase.requestBooking(match.tripId, criteria.childUserId, criteria.seatsNeeded)
        }) { onNotice("Demande envoyée.") }
    }

    fun close() {
        requests.close()
        origin = null
        destination = null
        originInput = ""
        destinationInput = ""
        form = defaultSearchForm()
        initializedChild = false
        originSuggestions = emptyList()
        destinationSuggestions = emptyList()
        matches = emptyList()
        acceptedCriteria = null
        loading = false
        hasSearched = false
    }

    private fun currentCriteria(): TripSearchCriteria? {
        val from = origin ?: return null
        val to = destination ?: return null
        if (form.validationMessage() != null) return null
        return TripSearchCriteria(from, to, form.desiredDepartureAtIso, form.seatsNeeded, form.baggage,
            form.returnTrip, form.requireChildTracking, form.guardianConsent, form.childUserId)
    }
    private fun invalidateMatches() {
        requests.invalidate(SearchRequest.Matches)
        acceptedCriteria = null
        matches = emptyList()
        hasSearched = false
    }
    private fun SearchPlaceTarget.request() = if (this == SearchPlaceTarget.Origin) SearchRequest.Origin else SearchRequest.Destination
}
