package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.services.MockFirebaseGateway
import be.sportgreenmoove.app.services.MockRadarTrackingGateway
import kotlinx.coroutines.launch

@Composable
fun SportsGreenMooveApp() {
    val firebase = remember { MockFirebaseGateway() }
    val radar = remember { MockRadarTrackingGateway() }
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf(DemoScreen.Home) }
    var role by remember { mutableStateOf(AppRole.Parent) }
    var trips by remember { mutableStateOf(emptyList<TripSummary>()) }
    var activeRide by remember { mutableStateOf<LiveRideSnapshot?>(null) }
    var darkTheme by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        trips = firebase.searchTrips()
    }

    val displayTrips = remember(trips) { enrichTrips(trips) }

    SgmTheme(darkTheme = darkTheme) {
        V2ThemeToggleProvider(darkTheme = darkTheme, onToggle = { darkTheme = !darkTheme }) {
            Scaffold(
                containerColor = Sgm.colors.bgApp,
                bottomBar = {
                    if (screen != DemoScreen.Onboarding) {
                        AppBottomBar(
                            current = screen.toTopLevel(),
                            onNavigate = { destination -> screen = destination },
                        )
                    }
                },
            ) { padding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Sgm.colors.bgApp)
                        .padding(padding),
                ) {
                    when (screen) {
                        DemoScreen.Home -> HomeScreen(
                            trips = displayTrips,
                            onTrips = { screen = DemoScreen.Trips },
                            onRide = { screen = DemoScreen.Ride },
                            onImpact = { screen = DemoScreen.Impact },
                        )

                        DemoScreen.Trips -> TripsScreen(
                            trips = displayTrips,
                            activeRide = activeRide,
                            onStartRide = {
                                scope.launch {
                                    val trip = displayTrips.firstOrNull() ?: return@launch
                                    val ride = firebase.startRide(trip.id)
                                    radar.startTripTracking(ride.rideSessionId, role)
                                    activeRide = ride
                                    screen = DemoScreen.Ride
                                }
                            },
                            onOpenSearch = { screen = DemoScreen.Search },
                        )

                        DemoScreen.Publish -> PublishScreen(role = role)
                        DemoScreen.Messages -> MessagesScreen()
                        DemoScreen.Profile -> ProfileScreen(
                            role = role,
                            onRoleChange = { role = it },
                            onGroups = { screen = DemoScreen.Groups },
                            onImpact = { screen = DemoScreen.Impact },
                            onRewards = { screen = DemoScreen.Rewards },
                            onOptions = { screen = DemoScreen.Options },
                            onLogout = { screen = DemoScreen.Onboarding },
                        )

                        DemoScreen.Onboarding -> OnboardingScreen(onDone = { screen = DemoScreen.Home })
                        DemoScreen.Search -> SearchScreen(trips = displayTrips, onBack = { screen = DemoScreen.Home })
                        DemoScreen.Groups -> GroupsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Impact -> ImpactScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Rewards -> RewardsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Options -> OptionsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Ride -> RideMonitorScreen(
                            activeRide = activeRide,
                            onBack = { screen = DemoScreen.Trips },
                        )
                    }
                }
            }
        }
    }
}

fun DemoScreen.toTopLevel(): DemoScreen =
    when (this) {
        DemoScreen.Search -> DemoScreen.Home
        DemoScreen.Groups, DemoScreen.Impact, DemoScreen.Rewards, DemoScreen.Options -> DemoScreen.Profile
        DemoScreen.Ride -> DemoScreen.Trips
        DemoScreen.Onboarding -> DemoScreen.Home
        else -> this
    }

fun roleLabel(role: AppRole): String =
    when (role) {
        AppRole.Parent -> "Parent"
        AppRole.Driver -> "Conducteur"
        AppRole.Child -> "Enfant"
        AppRole.ClubManager -> "Club manager"
        AppRole.Admin -> "Admin"
    }

fun enrichTrips(source: List<TripSummary>): List<TripSummary> {
    val fallback = if (source.isEmpty()) {
        listOf(
            TripSummary(
                id = "trip-u8-royal",
                title = "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
                club = "Royal Ottignies",
                category = "U8",
                departureLabel = "07 NOV · 16h45",
                seatsAvailable = 2,
                priceLabel = "2,50 EUR",
                reasons = listOf("+6 min détour", "2 places disponibles", "Même équipe U8", "Suivi enfant disponible"),
            ),
            TripSummary(
                id = "trip-biereau",
                title = "ENTRAÎNEMENT U8 GROUPE B",
                club = "Collège du Biéreau",
                category = "U8",
                departureLabel = "10 NOV · 18h00",
                seatsAvailable = 1,
                priceLabel = "Gratuit",
                reasons = listOf("+9 min détour", "Même club", "Trajet gratuit"),
            ),
        )
    } else {
        source
    }

    return fallback + listOf(
        TripSummary(
            id = "trip-bruges",
            title = "U8 VS FOOTBALL CLUB DE BRUGES",
            club = "Royal Ottignies",
            category = "U8",
            departureLabel = "12 NOV · 09h15",
            seatsAvailable = 3,
            priceLabel = "4,00 EUR",
            reasons = listOf("+11 min détour", "Même équipe", "Retour proposé"),
        ),
        TripSummary(
            id = "trip-tennis",
            title = "COMPÉTITION JUNIOR TENNIS",
            club = "Louvain Tennis Club",
            category = "JUNIOR",
            departureLabel = "13 NOV · 13h20",
            seatsAvailable = 1,
            priceLabel = "3,00 EUR",
            reasons = listOf("+4 min détour", "Conducteur 4,9", "CO₂ +1,2 kg"),
        ),
        TripSummary(
            id = "trip-natation",
            title = "ENTRAÎNEMENT NATATION",
            club = "Blocry",
            category = "U10",
            departureLabel = "14 NOV · 17h30",
            seatsAvailable = 2,
            priceLabel = "2,00 EUR",
            reasons = listOf("+7 min détour", "Arrivée 10 min avant", "Suivi véhicule"),
        ),
    )
}

enum class DemoScreen {
    Home,
    Trips,
    Publish,
    Messages,
    Profile,
    Onboarding,
    Search,
    Groups,
    Impact,
    Rewards,
    Options,
    Ride,
}
