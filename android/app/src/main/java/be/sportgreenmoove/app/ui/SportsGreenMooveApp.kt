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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.rememberStripePaymentSheetController
import com.stripe.android.paymentsheet.PaymentSheetResult
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
    var payableBookings by remember { mutableStateOf(emptyList<PayableBookingSummary>()) }
    var darkTheme by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var noticeMessage by remember { mutableStateOf<String?>(null) }
    val activeRidePermissionGate = rememberActiveRidePermissionGate { message ->
        errorMessage = message
    }

    suspend fun refreshAppData() {
        trips = providers.firebase.searchTrips()
        activeRide = providers.firebase.getActiveRide()
        payableBookings = providers.firebase.getPayableBookings()
    }

    val paymentSheet = rememberStripePaymentSheetController { result ->
        when (result) {
            is PaymentSheetResult.Completed -> {
                noticeMessage = "Paiement confirmé."
                scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = it.message } }
            }
            is PaymentSheetResult.Canceled -> {
                noticeMessage = "Paiement annulé."
            }
            is PaymentSheetResult.Failed -> {
                errorMessage = result.error.localizedMessage ?: "Paiement Stripe refusé."
            }
        }
    }

    suspend fun handleTripAction(trip: TripSummary) {
        if (role == AppRole.Driver) {
            val ride = providers.firebase.startRide(trip.id)
            activeRide = ride
            if (providers.radar.isConfigured) {
                providers.radar.startTripTracking(ride.rideSessionId, role)
            } else {
                providers.firebase.writeNativeLocationFallback(ride.rideSessionId, role)
                noticeMessage = "Suivi GPS natif activé."
            }
            screen = DemoScreen.Ride
        } else {
            val bookingId = providers.firebase.requestBooking(trip.id)
            noticeMessage = "Demande envoyée: $bookingId"
        }
    }

    fun launchPayment(booking: PayableBookingSummary) {
        scope.launch {
            loading = true
            errorMessage = null
            runCatching {
                if (!providers.stripe.isConfigured) {
                    error("Stripe Android n'est pas configuré.")
                }
                val config = providers.stripe.prepareRidePayment(booking.bookingId)
                paymentSheet.present(config)
            }.onFailure {
                errorMessage = it.message
            }
            loading = false
        }
    }

    fun launchTripAction(trip: TripSummary) {
        val action: () -> Unit = {
            scope.launch {
                runCatching {
                    handleTripAction(trip)
                }.onFailure { errorMessage = it.message }
            }
        }

        if (role == AppRole.Driver) {
            activeRidePermissionGate.runWhenReady(action)
        } else {
            action()
        }
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
                                    launchTripAction(trip)
                                }
                            },
                            onImpact = { screen = DemoScreen.Impact },
                        )

                        DemoScreen.Trips -> TripsScreen(
                            trips = trips,
                            activeRide = activeRide,
                            onTripAction = { trip ->
                                launchTripAction(trip)
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
                            onPayments = { screen = DemoScreen.Payments },
                            onOptions = { screen = DemoScreen.Options },
                            onLogout = {
                                providers.auth.signOut()
                                session = null
                                trips = emptyList()
                                activeRide = null
                                payableBookings = emptyList()
                                screen = DemoScreen.Home
                            },
                        )

                        DemoScreen.Search -> SearchScreen(trips = trips, onBack = { screen = DemoScreen.Home })
                        DemoScreen.Groups -> GroupsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Impact -> ImpactScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Rewards -> RewardsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Options -> OptionsScreen(onBack = { screen = DemoScreen.Profile })
                        DemoScreen.Payments -> PaymentsScreen(
                            bookings = payableBookings,
                            loading = loading,
                            onBack = { screen = DemoScreen.Profile },
                            onPay = { booking -> launchPayment(booking) },
                        )
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
