package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripPublishDraft
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun rememberPublishController(
    firebase: FirebaseGateway,
    scope: CoroutineScope,
    onError: (String?) -> Unit,
    onNotice: (String) -> Unit,
    onPublished: () -> Unit,
): PublishController = remember(firebase, scope) {
    PublishController(
        firebase = firebase,
        scope = scope,
        onError = onError,
        onNotice = onNotice,
        onPublished = onPublished,
    )
}

class PublishController(
    private val firebase: FirebaseGateway,
    private val scope: CoroutineScope,
    private val onError: (String?) -> Unit,
    private val onNotice: (String) -> Unit,
    private val onPublished: () -> Unit,
) {
    var origin by mutableStateOf<ResolvedPlace?>(null)
        private set
    var destination by mutableStateOf<ResolvedPlace?>(null)
        private set
    var originSuggestions by mutableStateOf(emptyList<PlaceSuggestion>())
        private set
    var destinationSuggestions by mutableStateOf(emptyList<PlaceSuggestion>())
        private set
    var loading by mutableStateOf(false)
        private set

    fun seedPlaces(initialOrigin: ResolvedPlace?, initialDestination: ResolvedPlace?) {
        if (initialOrigin != null && origin == null) {
            origin = initialOrigin
        }
        if (initialDestination != null && destination == null) {
            destination = initialDestination
        }
    }

    fun suggestPlaces(input: String, target: SearchPlaceTarget) {
        if (input.isBlank()) {
            onError("Saisissez une adresse à chercher.")
            return
        }
        scope.launch {
            loading = true
            onError(null)
            runCatching { firebase.suggestPlaces(input) }
                .onSuccess { setSuggestions(target, it) }
                .onFailure { onError(it.message) }
            loading = false
        }
    }

    fun selectPlace(suggestion: PlaceSuggestion, target: SearchPlaceTarget) {
        scope.launch {
            loading = true
            onError(null)
            runCatching { firebase.resolvePlace(suggestion.placeId) }
                .onSuccess { place ->
                    if (target == SearchPlaceTarget.Origin) {
                        origin = place
                        originSuggestions = emptyList()
                    } else {
                        destination = place
                        destinationSuggestions = emptyList()
                    }
                }
                .onFailure { onError(it.message) }
            loading = false
        }
    }

    fun publish(draft: TripPublishDraft?) {
        if (draft == null) {
            onError("Choisissez un départ et une destination dans les suggestions.")
            return
        }
        scope.launch {
            loading = true
            onError(null)
            runCatching { firebase.createTrip(draft) }
                .onSuccess { tripId ->
                    onNotice("Trajet publié: $tripId")
                    onPublished()
                }
                .onFailure { onError(it.message) }
            loading = false
        }
    }

    private fun setSuggestions(target: SearchPlaceTarget, suggestions: List<PlaceSuggestion>) {
        if (target == SearchPlaceTarget.Origin) {
            originSuggestions = suggestions
        } else {
            destinationSuggestions = suggestions
        }
    }
}
