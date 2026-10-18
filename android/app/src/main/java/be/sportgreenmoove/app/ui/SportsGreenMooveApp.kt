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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.domain.canManageRide
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.launch
@Composable
fun SportsGreenMooveApp() {
    val context = LocalContext.current
    val providers = remember { AndroidRuntime.create(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var screen by rememberSaveable { mutableStateOf(AppScreen.Home) }
    val messagesState = rememberSaveableStateHolder()
    var role by remember { mutableStateOf(AppRole.Parent) }
    var lastRoleSelectionSessionUid by remember { mutableStateOf<String?>(null) }
    var session by remember { mutableStateOf<AuthSession?>(null) }
    val appData = remember { AppDataState() }
    var trips by appData.trips
    var children by appData.children
    val clubs by appData.clubs
    var activeRide by appData.activeRide
    var activeRideTrip by appData.activeRideTrip
    var payableBookings by appData.payableBookings
    var driverBookingRequests by appData.driverBookingRequests
    var ledgerSummaries by appData.ledgerSummaries
    var darkTheme by rememberAppDarkTheme()
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var noticeMessage by remember { mutableStateOf<String?>(null) }
    val activeRidePermissionGate = rememberActiveRidePermissionGate { message ->
        errorMessage = message
    }
    val searchController = rememberSearchController(
        providers = providers,
        scope = scope,
        sessionUid = session?.uid,
        onError = { errorMessage = it },
        onNotice = { noticeMessage = it },
        onAppLoading = { loading = it },
    )
    suspend fun refreshAppData() {
        appData.refresh(providers, role)
    }
    val paymentSheet = rememberSportsGreenMoovePaymentSheetController(
        scope = scope,
        sessionUid = session?.uid,
        gateway = providers.stripe,
        refreshAppData = { refreshAppData() },
        setError = { errorMessage = it },
        setNotice = { noticeMessage = it },
    )
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
    fun logout() {
        searchController.close()
        session?.uid?.let { messagesState.removeState(it) }
        providers.googleAuth.signOut()
        providers.facebookAuth.signOut()
        providers.auth.signOut()
        session = null
        lastRoleSelectionSessionUid = null
        role = AppRole.Parent
        appData.clear()
        loading = false
        noticeMessage = null
        errorMessage = null
        screen = AppScreen.Home
    }
    val restoration = rememberSessionRestoration(providers.auth, providers.isConfigured) { restored ->
        session = restored
        if (restored != null) {
            runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) }
        }
    }
    LaunchedEffect(session?.uid, session?.roles) {
        val currentSession = session
        if (currentSession == null) {
            lastRoleSelectionSessionUid = null
        } else {
            val sessionChanged = currentSession.uid != lastRoleSelectionSessionUid
            val selectedRole = selectActiveMobileRole(
                currentRole = role,
                availableRoles = currentSession.roles,
                sessionChanged = sessionChanged,
            )
            lastRoleSelectionSessionUid = currentSession.uid
            if (selectedRole != role) {
                role = selectedRole
                runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) }
            }
        }
    }
    SgmTheme(darkTheme = darkTheme) {
        AppSystemBars(darkBackground = darkTheme)
        V2ThemeToggleProvider(darkTheme = darkTheme, onToggle = { darkTheme = !darkTheme }) {
            if (!providers.isConfigured) {
                ConfigurationRequiredScreen()
                return@V2ThemeToggleProvider
            }
            if (restoration.phase != SessionRestorationPhase.Ready) {
                SessionRestorationScreen(restoration, ::logout) { session = it }
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
                notice = noticeMessage,
                error = errorMessage,
                onDismissMessage = {
                    noticeMessage = null
                    errorMessage = null
                },
            ) { padding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Sgm.colors.bgApp)
                        .padding(padding),
                ) {
                    when (screen) {
                        AppScreen.Home -> HomeScreen(
                            displayName = session?.displayName,
                            trips = trips,
                            impactSummary = ledgerSummaries.impact,
                            onTrips = { screen = AppScreen.Trips },
                            onRide = { trips.firstOrNull { it.status == be.sportgreenmoove.app.data.TripStatus.Upcoming }?.let(::runTripAction) },
                            onImpact = { screen = AppScreen.Impact },
                        )
                        AppScreen.Trips -> TripsRoute(
                            uid = requireNotNull(session).uid, role = role, gateway = providers.firebase,
                            onChanged = { refreshAppData() },
                            trips = trips,
                            activeRide = activeRide,
                            pendingCount = driverBookingRequests.count { it.status == "requested" },
                            onTripAction = ::runTripAction,
                            onOpenSearch = { screen = AppScreen.Search },
                            onOpenRide = { screen = AppScreen.Ride },
                            reservationContent = {
                                ReservationManagementRoute(requireNotNull(session).uid, role, providers.reservations, providers.firebase) { refreshAppData() }
                            },
                        )
                        AppScreen.Publish -> PublishScreen(
                            role = role,
                            firebase = providers.firebase,
                            memberClubs = clubs.filter { it.isMember },
                            initialOrigin = searchController.origin,
                            initialDestination = searchController.destination,
                            onError = { errorMessage = it },
                            onNotice = { noticeMessage = it },
                            onPublished = { scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) } } },
                        )
                        AppScreen.Messages -> session?.uid?.let { uid ->
                            messagesState.SaveableStateProvider(uid) {
                                MessagesScreen(firebase = providers.firebase, conversations = providers.conversations)
                            }
                        }
                        AppScreen.Profile -> ProfileRoute(
                            role = role,
                            availableRoles = session?.roles ?: setOf(AppRole.Parent),
                            session = session,
                            clubs = clubs,
                            ledgerSummaries = ledgerSummaries,
                            onRoleChange = {
                                role = it
                                scope.launch { runCatching { refreshAppData() }.onFailure { errorMessage = UserFacingErrorPolicy.messageFor(it) } }
                            },
                            onGroups = { screen = AppScreen.Groups },
                            onImpact = { screen = AppScreen.Impact },
                            onRewards = { screen = AppScreen.Rewards },
                            onPayments = { screen = AppScreen.Payments },
                            onOptions = { screen = AppScreen.Options },
                            onLogout = ::logout,
                        )
                        AppScreen.Search -> SearchRoute(
                            searchController = searchController,
                            children = children,
                            error = errorMessage,
                            onBack = { screen = AppScreen.Home },
                        )
                        AppScreen.Groups -> GroupsRoute(
                            sessionUid = requireNotNull(session).uid,
                            providers = providers,
                            onBack = { screen = AppScreen.Profile },
                            onClubsLoaded = appData::replaceClubs,
                            onGuardianVerification = if (AppRole.Parent in requireNotNull(session).roles) ({ screen = AppScreen.Guardians }) else null,
                        )
                        AppScreen.Guardians -> GuardianVerificationRoute(requireNotNull(session).uid, providers.firebase) { screen = AppScreen.Groups }
                        AppScreen.Impact -> ImpactScreen(summary = ledgerSummaries.impact, onBack = { screen = AppScreen.Profile })
                        AppScreen.Rewards -> RewardsRoute(
                            summary = ledgerSummaries.rewards,
                            availableRoles = session?.roles ?: setOf(AppRole.Parent),
                            onBack = { screen = AppScreen.Profile },
                            onOpenPayments = { payoutRole ->
                                role = payoutRole
                                screen = AppScreen.Payments
                            },
                            setError = { errorMessage = it },
                        )
                        AppScreen.Options -> OptionsScreen(firebase = providers.firebase, onBack = { screen = AppScreen.Profile })
                        AppScreen.Payments -> PaymentsRoute(role = role, sessionEmail = session?.email, bookings = payableBookings, loading = loading, providers = providers, paymentSheet = paymentSheet, scope = scope, onBack = { screen = AppScreen.Profile }, setLoading = { loading = it }, setError = { errorMessage = it }, setNotice = { noticeMessage = it })
                        AppScreen.Ride -> RideMonitorScreen(
                            activeRide = activeRide,
                            canManageRide = canManageRide(role, session, activeRide),
                            routePreview = activeRideTrip?.mapPreview,
                            onBack = { screen = AppScreen.Trips },
                            onPickup = { updatePassengerStatus(it, pickup = true) },
                            onDropoff = { updatePassengerStatus(it, pickup = false) },
                            onEndRide = ::endActiveRide,
                        )
                    }
                }
            }
        }
    }
}
