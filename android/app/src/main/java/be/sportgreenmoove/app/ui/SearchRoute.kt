package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import be.sportgreenmoove.app.data.ChildSummary

@Composable
fun SearchRoute(
    searchController: SearchController,
    children: List<ChildSummary>,
    error: String?,
    onBack: () -> Unit,
) = key(searchController) {
    SearchScreen(
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
        onOriginChanged = { searchController.editPlace(SearchPlaceTarget.Origin) },
        onDestinationChanged = { searchController.editPlace(SearchPlaceTarget.Destination) },
    )
}
