package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.launch

@Composable
fun SportsGreenMooveApp() {
    val context = LocalContext.current
    val providers = remember { AndroidRuntime.create(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf(DemoScreen.Home) }
    var role by remember { mutableStateOf(AppRole.Parent) }
    var session by remember { mutableStateOf<AuthSession?>(null) }
    var trips by remember { mutableStateOf(emptyList<TripSummary>()) }
    var activeRide by remember { mutableStateOf<LiveRideSnapshot?>(null) }
    var darkTheme by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var noticeMessage by remember { mutableStateOf<String?>(null) }

    suspend fun refreshAppData() {
        trips = providers.firebase.searchTrips()
        activeRide = providers.firebase.getActiveRide()
    }

    LaunchedEffect(providers) {
        if (providers.isConfigured) {
            session = providers.auth.currentSession()
            if (session != null) {
                runCatching { refreshAppData() }.onFailure { errorMessage = it.message }
            }
        }
    }

    SgmTheme(darkTheme = darkTheme) {
        V2ThemeToggleProvider(darkTheme = darkTheme, onToggle = { darkTheme = !darkTheme }) {
            if (!providers.isConfigured) {
                ConfigurationRequiredScreen()
                return@V2ThemeToggleProvider
            }

            if (session == null) {
                OnboardingScreen(
                    loading = loading,
                    error = errorMessage,
                    onSubmit = { mode, name, email, password ->
                        scope.launch {
                            loading = true
                            errorMessage = null
                            runCatching {
                                session = if (mode == OnboardingMode.Login) {
                                    providers.auth.signIn(email, password)
                                } else {
                                    providers.auth.signUp(name, email, password)
                                }
                                refreshAppData()
                            }.onFailure { errorMessage = it.message }
                            loading = false
                        }
                    },
                    onUnsupportedSocial = {
                        errorMessage = "Connexion sociale à configurer avec Firebase Auth."
                    },
                )
                return@V2ThemeToggleProvider
            }

            Scaffold(
                containerColor = Sgm.colors.bgApp,
                bottomBar = {
                    AppBottomBar(
                        current = screen.toTopLevel(),
                        onNavigate = { destination -> screen = destination },
                    )
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
                            trips = trips,
                            onTrips = { screen = DemoScreen.Trips },
                            onRide = {
                                trips.firstOrNull()?.let { trip ->
                                    scope.launch {
                                        runCatching {
                                            if (role == AppRole.Driver) {
                                                val ride = providers.firebase.startRide(trip.id)
                                                activeRide = ride
                                                if (providers.radar.isConfigured) {
                                                    providers.radar.startTripTracking(ride.rideSessionId, role)
                                                }
                                                screen = DemoScreen.Ride
                                            } else {
                                                val bookingId = providers.firebase.requestBooking(trip.id)
                                                noticeMessage = "Demande envoyée: $bookingId"
                                            }
                                        }.onFailure { errorMessage = it.message }
                                    }
                                }
                            },
                            onImpact = { screen = DemoScreen.Impact },
                        )

                        DemoScreen.Trips -> TripsScreen(
                            trips = trips,
                            activeRide = activeRide,
                            onTripAction = { trip ->
                                scope.launch {
                                    runCatching {
                                        if (role == AppRole.Driver) {
                                            val ride = providers.firebase.startRide(trip.id)
                                            activeRide = ride
                                            if (providers.radar.isConfigured) {
                                                providers.radar.startTripTracking(ride.rideSessionId, role)
                                            }
                                            screen = DemoScreen.Ride
                                        } else {
                                            val bookingId = providers.firebase.requestBooking(trip.id)
                                            noticeMessage = "Demande envoyée: $bookingId"
                                        }
                                    }.onFailure { errorMessage = it.message }
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
                            onLogout = {
                                providers.auth.signOut()
                                session = null
                                trips = emptyList()
                                activeRide = null
                                screen = DemoScreen.Home
                            },
                        )

                        DemoScreen.Search -> SearchScreen(trips = trips, onBack = { screen = DemoScreen.Home })
                        DemoScreen.Groups -> GroupsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Impact -> ImpactScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Rewards -> RewardsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Options -> OptionsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Ride -> RideMonitorScreen(
                            activeRide = activeRide,
                            onBack = { screen = DemoScreen.Trips },
                        )
                    }
                    val runtimeMessage = noticeMessage ?: errorMessage
                    runtimeMessage?.let {
                        RuntimeNotice(
                            message = it,
                            warning = errorMessage != null,
                            onDismiss = {
                                noticeMessage = null
                                errorMessage = null
                            },
                            modifier = Modifier.align(Alignment.TopCenter),
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

enum class DemoScreen {
    Home,
    Trips,
    Publish,
    Messages,
    Profile,
    Search,
    Groups,
    Impact,
    Rewards,
    Options,
    Ride,
}

@Composable
private fun RuntimeNotice(message: String, warning: Boolean, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    Text(
        text = message,
        style = SgmType.BodyXS.copy(
            color = if (warning) SgmColor.Orange else SgmColor.Green,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        ),
        modifier = modifier
            .padding(horizontal = 20.dp, vertical = 10.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(
                width = 1.dp,
                color = if (warning) SgmColor.Orange.copy(alpha = 0.42f) else Sgm.colors.border,
                shape = RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onDismiss)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    )
}
