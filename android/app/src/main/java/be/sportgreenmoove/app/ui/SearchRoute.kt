package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import be.sportgreenmoove.app.data.ChildSummary

@Composable
fun SearchRoute(
    searchController: SearchController,
    children: List<ChildSummary>,
    error: String?,
    onBack: () -> Unit,
) = key(searchController) {
    LaunchedEffect(children.map { it.id }) { searchController.updateChildren(children) }
    SearchScreen(
        originInput = searchController.originInput,
        destinationInput = searchController.destinationInput,
        form = searchController.form,
        origin = searchController.origin,
        destination = searchController.destination,
        originSuggestions = searchController.originSuggestions,
        destinationSuggestions = searchController.destinationSuggestions,
        children = children,
        matches = searchController.matches,
        loading = searchController.loading,
        error = error,
        hasSearched = searchController.hasSearched,
        onBack = onBack,
        onSuggestOrigin = { searchController.suggestPlaces(it, SearchPlaceTarget.Origin) },
        onSuggestDestination = { searchController.suggestPlaces(it, SearchPlaceTarget.Destination) },
        onSelectOrigin = { searchController.selectPlace(it, SearchPlaceTarget.Origin) },
        onSelectDestination = { searchController.selectPlace(it, SearchPlaceTarget.Destination) },
        onSearch = searchController::runSearch,
        onRequest = searchController::requestMatch,
        onOriginChanged = { searchController.editPlace(SearchPlaceTarget.Origin, it) },
        onDestinationChanged = { searchController.editPlace(SearchPlaceTarget.Destination, it) },
        onFormChange = searchController::updateForm,
    )
}
