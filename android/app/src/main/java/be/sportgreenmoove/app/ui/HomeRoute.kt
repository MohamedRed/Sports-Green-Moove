package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary

@Composable
internal fun HomeRoute(
    displayName: String?, data: AppDataState,
    onNavigate: (AppScreen) -> Unit, onTripAction: (TripSummary) -> Unit,
) {
    HomeScreen(
        displayName = displayName,
        trips = data.trips.value,
        impactSummary = data.ledgerSummaries.value.impact,
        onTrips = { onNavigate(AppScreen.Trips) },
        onRide = { data.trips.value.firstOrNull { it.status == TripStatus.Upcoming }?.let(onTripAction) },
        onImpact = { onNavigate(AppScreen.Impact) },
    )
}
