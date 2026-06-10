package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AppTab
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.SgmColors
import be.sportgreenmoove.app.design.SgmSpacing
import be.sportgreenmoove.app.services.MockFirebaseGateway
import be.sportgreenmoove.app.services.MockRadarTrackingGateway
import kotlinx.coroutines.launch

@Composable
fun SportsGreenMooveApp() {
    val firebase = remember { MockFirebaseGateway() }
    val radar = remember { MockRadarTrackingGateway() }
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableStateOf(AppTab.Home) }
    var role by remember { mutableStateOf(AppRole.Parent) }
    var trips by remember { mutableStateOf(emptyList<TripSummary>()) }
    var activeRide by remember { mutableStateOf<LiveRideSnapshot?>(null) }

    LaunchedEffect(Unit) {
        trips = firebase.searchTrips()
    }

    MaterialTheme {
        Scaffold(
            bottomBar = {
                NavigationBar(containerColor = SgmColors.Surface) {
                    AppTab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = selectedTab == tab,
                            onClick = { selectedTab = tab },
                            icon = { Text(tab.label.take(1), fontWeight = FontWeight.Black) },
                            label = { Text(tab.label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        )
                    }
                }
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(SgmColors.AppBackground)
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = SgmSpacing.X8),
                verticalArrangement = Arrangement.spacedBy(SgmSpacing.X4)
            ) {
                when (selectedTab) {
                    AppTab.Home -> HomeScreen(role, trips) { selectedTab = AppTab.GreenList }
                    AppTab.GreenList -> GreenListScreen(trips, activeRide) {
                        scope.launch {
                            val trip = trips.firstOrNull() ?: return@launch
                            val ride = firebase.startRide(trip.id)
                            radar.startTripTracking(ride.rideSessionId, role)
                            activeRide = ride
                        }
                    }
                    AppTab.Publish -> PublishScreen(role)
                    AppTab.Search -> SearchScreen(trips)
                    AppTab.Notifications -> SimpleListScreen("Notifications", listOf("Nouveau message de Nadège TOUSSAINT", "Kévin a été déposé à destination"))
                    AppTab.Co2 -> ImpactScreen()
                    AppTab.Rewards -> RewardsScreen()
                    AppTab.Options -> SimpleListScreen("Options", listOf("Mon profil", "Enfants et consentements", "Permissions de localisation", "Moyens de paiement"))
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(role: AppRole, trips: List<TripSummary>, onOpenRide: () -> Unit) {
    AppHeader(role)
    HeroCard(onOpenRide)
    StatsRow()
    SectionTitle("Semaine à venir")
    TripList(trips)
}

@Composable
private fun GreenListScreen(trips: List<TripSummary>, activeRide: LiveRideSnapshot?, onStartRide: () -> Unit) {
    SectionTitle("Green-List")
    TripList(trips)
    if (activeRide == null) {
        PrimaryButton("Démarrer le suivi", onStartRide)
    } else {
        LiveRideCard(activeRide)
    }
}

@Composable
private fun PublishScreen(role: AppRole) {
    AppHeader(role)
    SectionTitle("Publier votre trajet")
    FormRow("Club", "Royal Ottignies")
    FormRow("Catégorie", "U8 Nationaux")
    FormRow("Aller-retour", "Oui")
    FormRow("Places disponibles", "2")
    FormRow("Bagage", "Moyen")
    FormRow("Suivi enfant", "Activé")
    PrimaryButton("Publier") {}
}

@Composable
private fun SearchScreen(trips: List<TripSummary>) {
    SectionTitle("Recherche")
    Text(
        modifier = Modifier.padding(horizontal = SgmSpacing.X5),
        text = "Destination, club, événement",
        color = SgmColors.TextMuted,
        fontWeight = FontWeight.SemiBold
    )
    TripList(trips)
}

@Composable
private fun ImpactScreen() {
    SectionTitle("Mon impact CO2")
    StatCard("12,4", "kg CO2 économisés")
    StatCard("37 356", "utilisateurs en Wallonie")
}

@Composable
private fun RewardsScreen() {
    SectionTitle("Récompenses")
    StatCard("45,40", "crédit disponible")
    PrimaryButton("Configurer Stripe Connect") {}
}

@Composable
private fun SimpleListScreen(title: String, items: List<String>) {
    SectionTitle(title)
    items.forEach { FormRow(it, "Ouvrir") }
}

@Composable
private fun AppHeader(role: AppRole) {
    Column(modifier = Modifier.padding(SgmSpacing.X5), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
        Wordmark()
        Text(
            text = "COVOITURAGE SPORTIF & CULTUREL · ${role.name}",
            color = SgmColors.Green,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
        )
    }
}

@Composable
private fun Wordmark() {
    Row(verticalAlignment = Alignment.Bottom) {
        Text("SPORTS ", color = SgmColors.TextMuted, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("GREEN-", color = SgmColors.Green, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("m", color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
        Text("OO", color = SgmColors.Green, fontSize = 38.sp, fontWeight = FontWeight.Black)
        Text("Ve", color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun HeroCard(onOpenRide: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(horizontal = SgmSpacing.X5)
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColors.GreenDark)
            .padding(SgmSpacing.X5),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3)
    ) {
        Text("PROCHAINE COURSE", color = SgmColors.GreenLight, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text("U8 NATIONAUX VS ROYAL OTTIGNIES SC", color = SgmColors.Surface, fontSize = 28.sp, fontWeight = FontWeight.Black)
        Text("07 NOV · 16h45 · 2 passagers", color = SgmColors.Surface.copy(alpha = 0.72f), fontWeight = FontWeight.SemiBold)
        PrimaryButton("Voir le trajet", onOpenRide)
    }
}

@Composable
private fun StatsRow() {
    Row(modifier = Modifier.padding(horizontal = SgmSpacing.X5), horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
        StatCard("12,4", "kg CO2", Modifier.weight(1f))
        StatCard("24", "trajets", Modifier.weight(1f))
        StatCard("45,40", "EUR", Modifier.weight(1f))
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        modifier = Modifier.padding(horizontal = SgmSpacing.X5),
        text = title.uppercase(),
        color = SgmColors.TextPrimary,
        fontSize = 20.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.4.sp
    )
}

@Composable
private fun TripList(trips: List<TripSummary>) {
    Column(modifier = Modifier.padding(horizontal = SgmSpacing.X5), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
        trips.forEach { TripCard(it) }
    }
}

@Composable
private fun TripCard(trip: TripSummary) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Card)
            .padding(SgmSpacing.X4),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3)
    ) {
        Row {
            Text(trip.category.uppercase(), color = SgmColors.Green, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            Text(trip.departureLabel, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(trip.title, color = SgmColors.TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text(trip.club, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        trip.reasons.take(3).forEach { reason ->
            Text(reason, color = SgmColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun LiveRideCard(ride: LiveRideSnapshot) {
    Column(
        modifier = Modifier
            .padding(horizontal = SgmSpacing.X5)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Card)
            .padding(SgmSpacing.X4),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)
    ) {
        Text("SUIVI EN DIRECT", fontSize = 18.sp, fontWeight = FontWeight.Black, color = SgmColors.TextPrimary)
        Text(ride.etaLabel, fontWeight = FontWeight.Bold)
        Text("Véhicule: ${ride.vehicleLastUpdateLabel}")
        ride.childLastUpdateLabel?.let { Text("Enfant: $it") }
        if (ride.stale) Text("Position à vérifier", color = SgmColors.Red)
    }
}

@Composable
private fun StatCard(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .padding(horizontal = SgmSpacing.X5)
            .clip(RoundedCornerShape(14.dp))
            .background(SgmColors.Card)
            .padding(SgmSpacing.X3),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, color = SgmColors.Green, fontSize = 30.sp, fontWeight = FontWeight.Black)
        Text(label, color = SgmColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun FormRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .padding(horizontal = SgmSpacing.X5)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SgmColors.Surface)
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = SgmColors.TextPrimary, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.weight(1f))
        Text(value, color = SgmColors.Green, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PrimaryButton(title: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = SgmColors.Green, contentColor = SgmColors.Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .padding(horizontal = SgmSpacing.X5)
            .fillMaxWidth()
            .height(48.dp)
    ) {
        Text(title.uppercase(), fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
    }
}

