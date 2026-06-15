package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun rememberSearchController(
    providers: AndroidProviderSet,
    scope: CoroutineScope,
    onError: (String?) -> Unit,
    onNotice: (String) -> Unit,
    onAppLoading: (Boolean) -> Unit,
): SearchController = remember(providers, scope) {
    SearchController(
        providers = providers,
        scope = scope,
        onError = onError,
        onNotice = onNotice,
        onAppLoading = onAppLoading,
    )
}

class SearchController(
    private val providers: AndroidProviderSet,
    private val scope: CoroutineScope,
    private val onError: (String?) -> Unit,
    private val onNotice: (String) -> Unit,
    private val onAppLoading: (Boolean) -> Unit,
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

    fun suggestPlaces(input: String, target: SearchPlaceTarget) {
        scope.launch {
            loading = true
            onError(null)
            runCatching { providers.firebase.suggestPlaces(input) }
                .onSuccess { suggestions ->
                    if (target == SearchPlaceTarget.Origin) {
                        originSuggestions = suggestions
                    } else {
                        destinationSuggestions = suggestions
                    }
                }
                .onFailure { onError(UserFacingErrorPolicy.messageFor(it)) }
            loading = false
        }
    }

    fun selectPlace(suggestion: PlaceSuggestion, target: SearchPlaceTarget) {
        scope.launch {
            loading = true
            onError(null)
            runCatching { providers.firebase.resolvePlace(suggestion.placeId) }
                .onSuccess { place ->
                    if (target == SearchPlaceTarget.Origin) {
                        origin = place
                        originSuggestions = emptyList()
                    } else {
                        destination = place
                        destinationSuggestions = emptyList()
                    }
                }
                .onFailure { onError(UserFacingErrorPolicy.messageFor(it)) }
            loading = false
        }
    }

    fun runSearch(form: SearchFormState) {
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

        scope.launch {
            loading = true
            onError(null)
            runCatching {
                providers.firebase.searchTripMatches(
                    TripSearchCriteria(
                        origin = selectedOrigin,
                        destination = selectedDestination,
                        desiredDepartureAtIso = form.desiredDepartureAtIso,
                        seatsNeeded = form.seatsNeeded,
                        baggage = form.baggage,
                        returnTrip = form.returnTrip,
                        requireChildTracking = form.requireChildTracking,
                        guardianConsent = form.guardianConsent,
                        childUserId = form.childUserId,
                    ),
                )
            }.onSuccess {
                matches = it
            }.onFailure { onError(UserFacingErrorPolicy.messageFor(it)) }
            loading = false
        }
    }

    fun requestMatch(match: TripMatchSummary, childUserId: String?) {
        scope.launch {
            onAppLoading(true)
            onError(null)
            runCatching {
                val bookingId = providers.firebase.requestBooking(match.tripId, childUserId)
                onNotice("Demande envoyée: $bookingId")
            }.onFailure { onError(UserFacingErrorPolicy.messageFor(it)) }
            onAppLoading(false)
        }
    }
}
