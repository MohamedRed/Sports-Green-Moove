package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.NativeLedgerSummaries
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.rememberStripePaymentSheetController
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.launch

@Composable
fun SportsGreenMooveApp() {
    val context = LocalContext.current
    val providers = remember { AndroidRuntime.create(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf(AppScreen.Home) }
    var role by remember { mutableStateOf(AppRole.Parent) }
    var session by remember { mutableStateOf<AuthSession?>(null) }
    var trips by remember { mutableStateOf(emptyList<TripSummary>()) }
    var children by remember { mutableStateOf(emptyList<ChildSummary>()) }
    var clubs by remember { mutableStateOf(emptyList<ClubSummary>()) }
    var activeRide by remember { mutableStateOf<LiveRideSnapshot?>(null) }
    var activeRideTrip by remember { mutableStateOf<TripSummary?>(null) }
    var payableBookings by remember { mutableStateOf(emptyList<PayableBookingSummary>()) }
    var driverBookingRequests by remember { mutableStateOf(emptyList<BookingRequestSummary>()) }
    var ledgerSummaries by remember { mutableStateOf(NativeLedgerSummaries()) }
    var darkTheme by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var noticeMessage by remember { mutableStateOf<String?>(null) }
    val activeRidePermissionGate = rememberActiveRidePermissionGate { message ->
        errorMessage = message
    }
    val searchController = rememberSearchController(
        providers = providers,
        scope = scope,
        onError = { errorMessage = it },
        onNotice = { noticeMessage = it },
        onAppLoading = { loading = it },
    )
    suspend fun refreshAppData() {
        trips = providers.firebase.searchTrips()
        children = if (role == AppRole.Parent) providers.firebase.listChildren() else emptyList()
        clubs = providers.firebase.listClubSummaries()
        activeRide = providers.firebase.getActiveRide()
        activeRideTrip = activeRide?.tripId?.let { tripId ->
            activeRideTrip?.takeIf { it.id == tripId } ?: trips.firstOrNull { it.id == tripId }
        }
        payableBookings = providers.firebase.getPayableBookings()
        ledgerSummaries = NativeLedgerSummaries(
            impact = providers.firebase.getImpactSummary(),
            rewards = providers.firebase.getRewardSummary(),
        )
        driverBookingRequests = if (role == AppRole.Driver) {
            providers.firebase.getDriverBookingRequests()
        } else {
            emptyList()
        }
    }
    val paymentSheet = rememberStripePaymentSheetController { result ->
        when (result) {
            is PaymentSheetResult.Completed -> {
                noticeMessage = "Paiement confirmé."
                scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) } }
            }
            is PaymentSheetResult.Canceled -> {
                noticeMessage = "Paiement annulé."
            }
            is PaymentSheetResult.Failed -> {
                errorMessage = UserFacingErrorPolicy.messageFor(result.error)
            }
        }
    }
    fun approveBooking(request: BookingRequestSummary) {
        launchApproveBooking(
            scope = scope,
            providers = providers,
            request = request,
            setLoading = { loading = it },
            setError = { errorMessage = it },
            setNotice = { noticeMessage = it },
            refreshAppData = { refreshAppData() },
        )
    }
    fun updatePassengerStatus(passenger: RidePassengerStatus, pickup: Boolean) {
        launchPassengerStatusUpdate(
            scope = scope,
            providers = providers,
            ride = activeRide,
            passenger = passenger,
            pickup = pickup,
            setLoading = { loading = it },
            setError = { errorMessage = it },
            setNotice = { noticeMessage = it },
            setActiveRide = { activeRide = it },
        )
    }
    fun endActiveRide() {
        launchEndActiveRide(
            scope = scope,
            providers = providers,
            ride = activeRide,
            activeRideTrip = activeRideTrip,
            setLoading = { loading = it },
            setError = { errorMessage = it },
            setNotice = { noticeMessage = it },
            setActiveRide = { activeRide = it },
            setActiveRideTrip = { activeRideTrip = it },
            setScreen = { screen = it },
            refreshAppData = { refreshAppData() },
        )
    }
    fun runTripAction(trip: TripSummary) {
        launchTripAction(
            scope = scope,
            providers = providers,
            trip = trip,
            role = role,
            driverBookingRequests = driverBookingRequests,
            activeRidePermissionGate = activeRidePermissionGate,
            setActiveRide = { activeRide = it },
            setActiveRideTrip = { activeRideTrip = it },
            setNotice = { noticeMessage = it },
            setScreen = { screen = it },
            setError = { errorMessage = it },
        )
    }

    LaunchedEffect(providers) {
        if (providers.isConfigured) {
            session = providers.auth.currentSession()
            if (session != null) {
                runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) }
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
                OnboardingRoute(
                    loading = loading,
                    error = errorMessage,
                    providers = providers,
                    scope = scope,
                    setLoading = { loading = it },
                    setError = { errorMessage = it },
                    setSession = { session = it },
                    refreshAppData = { refreshAppData() },
                )
                return@V2ThemeToggleProvider
            }

            SportsGreenMooveScaffold(
                currentScreen = screen,
                onNavigate = { destination -> screen = destination },
            ) { padding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Sgm.colors.bgApp)
                        .padding(padding),
                ) {
                    when (screen) {
                        AppScreen.Home -> HomeScreen(
                            trips = trips,
                            impactSummary = ledgerSummaries.impact,
                            onTrips = { screen = AppScreen.Trips },
                            onRide = { trips.firstOrNull()?.let(::runTripAction) },
                            onImpact = { screen = AppScreen.Impact },
                        )

                        AppScreen.Trips -> TripsScreen(
                            trips = trips,
                            activeRide = activeRide,
                            bookingRequests = driverBookingRequests,
                            onTripAction = ::runTripAction,
                            onOpenSearch = { screen = AppScreen.Search },
                            onOpenRide = { screen = AppScreen.Ride },
                            onApproveBooking = ::approveBooking,
                        )

                        AppScreen.Publish -> PublishScreen(
                            role = role,
                            firebase = providers.firebase,
                            initialOrigin = searchController.origin,
                            initialDestination = searchController.destination,
                            onError = { errorMessage = it },
                            onNotice = { noticeMessage = it },
                            onPublished = { scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) } } },
                        )
                        AppScreen.Messages -> MessagesScreen(firebase = providers.firebase)
                        AppScreen.Profile -> ProfileScreen(
                            role = role,
                            primaryClubLabel = clubs.firstOrNull { it.isMember }?.name ?: "Aucun club lié",
                            impactSummary = ledgerSummaries.impact,
                            rewardSummary = ledgerSummaries.rewards,
                            onRoleChange = {
                                role = it
                                scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) } }
                            },
                            onGroups = { screen = AppScreen.Groups },
                            onImpact = { screen = AppScreen.Impact },
                            onRewards = { screen = AppScreen.Rewards },
                            onPayments = { screen = AppScreen.Payments },
                            onOptions = { screen = AppScreen.Options },
                            onLogout = {
                                providers.googleAuth.signOut()
                                providers.facebookAuth.signOut()
                                providers.auth.signOut()
                                session = null
                                trips = emptyList()
                                children = emptyList()
                                clubs = emptyList()
                                activeRide = null
                                activeRideTrip = null
                                payableBookings = emptyList()
                                driverBookingRequests = emptyList()
                                ledgerSummaries = NativeLedgerSummaries()
                                screen = AppScreen.Home
                            },
                        )

                        AppScreen.Search -> SearchScreen(
                            origin = searchController.origin,
                            destination = searchController.destination,
                            originSuggestions = searchController.originSuggestions,
                            destinationSuggestions = searchController.destinationSuggestions,
                            children = children,
                            matches = searchController.matches,
                            loading = searchController.loading,
                            error = errorMessage,
                            onBack = { screen = AppScreen.Home },
                            onSuggestOrigin = { searchController.suggestPlaces(it, SearchPlaceTarget.Origin) },
                            onSuggestDestination = { searchController.suggestPlaces(it, SearchPlaceTarget.Destination) },
                            onSelectOrigin = { searchController.selectPlace(it, SearchPlaceTarget.Origin) },
                            onSelectDestination = { searchController.selectPlace(it, SearchPlaceTarget.Destination) },
                            onSearch = searchController::runSearch,
                            onRequest = searchController::requestMatch,
                        )
                        AppScreen.Groups -> GroupsScreen(clubs = clubs, onBack = { screen = AppScreen.Profile })
                        AppScreen.Impact -> ImpactScreen(summary = ledgerSummaries.impact, onBack = { screen = AppScreen.Profile })
                        AppScreen.Rewards -> RewardsScreen(summary = ledgerSummaries.rewards, onBack = { screen = AppScreen.Profile })
                        AppScreen.Options -> OptionsScreen(firebase = providers.firebase, onBack = { screen = AppScreen.Profile })
                        AppScreen.Payments -> PaymentsRoute(role = role, sessionEmail = session?.email, bookings = payableBookings, loading = loading, providers = providers, paymentSheet = paymentSheet, scope = scope, onBack = { screen = AppScreen.Profile }, setLoading = { loading = it }, setError = { errorMessage = it }, setNotice = { noticeMessage = it })
                        AppScreen.Ride -> RideMonitorScreen(
                            activeRide = activeRide,
                            routePreview = activeRideTrip?.mapPreview,
                            onBack = { screen = AppScreen.Trips },
                            onPickup = { updatePassengerStatus(it, pickup = true) },
                            onDropoff = { updatePassengerStatus(it, pickup = false) },
                            onEndRide = ::endActiveRide,
                        )
                    }
                    RuntimeNoticeHost(
                        notice = noticeMessage,
                        error = errorMessage,
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
