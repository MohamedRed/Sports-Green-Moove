package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm

@Composable
fun HomeScreen(
    displayName: String?,
    trips: List<TripSummary>,
    impactSummary: ImpactSummary,
    onTrips: () -> Unit,
    onRide: () -> Unit,
    onImpact: () -> Unit,
) {
    val homeTrips = rememberHomeTrips(trips)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .sgmTestTag(SgmTestTags.HomeScreen)
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 18.dp),
    ) {
        HomeHeader(displayName)
        HomeHeroCard(trip = trips.firstOrNull(), onClick = onRide)
        HomeStatsRow(impactSummary)
        HomeSectionLabel(
            title = "SEMAINE À VENIR",
            action = "Tout voir",
            onAction = onTrips,
            actionTestTag = SgmTestTags.HomeTripsAction,
        )
        Column(
            modifier = Modifier.padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            homeTrips.forEach { trip -> HomeTripCard(trip = trip, onClick = onTrips) }
            if (homeTrips.isEmpty()) {
                HomeEmptyTrips()
            }
        }
        HomeSectionLabel(title = "IMPACT ÉCOLOGIQUE", action = null, onAction = null)
        HomeImpactCard(summary = impactSummary, onClick = onImpact)
    }
}
