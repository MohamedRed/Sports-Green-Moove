package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripMatchSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SportsGreenMooveActionFlowTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun homeDashboardActionsDispatchTopLevelNavigation() {
        var tripsTapped = 0
        var rideTapped = 0
        var impactTapped = 0

        compose.setSgmUiTestContent {
            HomeScreen(
                displayName = "Nora Parent",
                trips = listOf(UiFlowFixtures.trip),
                impactSummary = UiFlowFixtures.impact,
                onTrips = { tripsTapped += 1 },
                onRide = { rideTapped += 1 },
                onImpact = { impactTapped += 1 },
            )
        }

        compose.onNodeWithTag(SgmTestTags.HomeRideAction).performClick()
        compose.onNodeWithTag(SgmTestTags.HomeTripsAction).performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.HomeImpactAction).performScrollTo().performClick()

        assertEquals(1, rideTapped)
        assertEquals(1, tripsTapped)
        assertEquals(1, impactTapped)
    }

    @Test
    fun searchActionsDispatchSelectedRideData() {
        var searchForm: SearchFormState? = null
        var requestedMatch: TripMatchSummary? = null
        var requestedChildId: String? = null

        compose.setSgmUiTestContent {
            SearchScreen(
                origin = UiFlowFixtures.origin,
                destination = UiFlowFixtures.destination,
                originSuggestions = emptyList(),
                destinationSuggestions = emptyList(),
                children = listOf(UiFlowFixtures.child),
                matches = listOf(UiFlowFixtures.match),
                loading = false,
                error = null,
                onBack = {},
                onSuggestOrigin = {},
                onSuggestDestination = {},
                onSelectOrigin = {},
                onSelectDestination = {},
                onSearch = { searchForm = it },
                onRequest = { match, childId ->
                    requestedMatch = match
                    requestedChildId = childId
                },
            )
        }

        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        assertEquals(UiFlowFixtures.child.id, searchForm?.childUserId)
        assertTrue(searchForm?.guardianConsent == true)

        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
        assertEquals(UiFlowFixtures.match.tripId, requestedMatch?.tripId)
        assertEquals(UiFlowFixtures.child.id, requestedChildId)
    }

    @Test
    fun publishSubmitActionCreatesBackendDraft() {
        val firebase = UiFlowFirebaseGateway()
        var published = false

        compose.setSgmUiTestContent {
            PublishScreen(
                role = AppRole.Driver,
                firebase = firebase,
                memberClubs = UiFlowFixtures.clubs,
                initialOrigin = UiFlowFixtures.origin,
                initialDestination = UiFlowFixtures.destination,
                onError = {},
                onNotice = {},
                onPublished = { published = true },
            )
        }

        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishSubmitAction).performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 5_000) { firebase.createdTripDraft != null && published }

        val draft = firebase.createdTripDraft
        assertEquals("club-royal", draft?.clubId)
        assertEquals(UiFlowFixtures.origin.placeId, draft?.origin?.placeId)
        assertEquals(UiFlowFixtures.destination.placeId, draft?.destination?.placeId)
        assertTrue(draft?.supportsChildTracking == true)
    }

    @Test
    fun publishSubmitFailureShowsFriendlyNetworkCopy() {
        val firebase = UiFlowFirebaseGateway().apply {
            failCreateTripMessage = "network unavailable while creating trip"
        }
        var error: String? = null
        var published = false

        compose.setSgmUiTestContent {
            PublishScreen(
                role = AppRole.Driver,
                firebase = firebase,
                memberClubs = UiFlowFixtures.clubs,
                initialOrigin = UiFlowFixtures.origin,
                initialDestination = UiFlowFixtures.destination,
                onError = { error = it },
                onNotice = {},
                onPublished = { published = true },
            )
        }

        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishSubmitAction).performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 5_000) { error != null }

        assertEquals("Connexion réseau indisponible. Vérifiez votre connexion puis réessayez.", error)
        assertTrue(!published)
    }

    @Test
    fun groupJoinActionDispatchesSelectedClub() {
        var joinedClubId: String? = null

        compose.setSgmUiTestContent {
            GroupsScreen(
                clubs = UiFlowFixtures.clubs,
                onBack = {},
                onJoinClub = { joinedClubId = it.id },
            )
        }

        compose.onNodeWithTag(SgmTestTags.GroupsJoinAction).performScrollTo().performClick()
        assertEquals("club-tennis", joinedClubId)
    }

    @Test
    fun bookingApprovalActionDispatchesSelectedRequest() {
        var approvedRequest: BookingRequestSummary? = null

        compose.setSgmUiTestContent {
            BookingRequestsList(
                requests = listOf(UiFlowFixtures.bookingRequest),
                onApprove = { approvedRequest = it },
            )
        }

        compose.onNodeWithTag(SgmTestTags.BookingApproveAction).performClick()
        assertEquals(UiFlowFixtures.bookingRequest.bookingId, approvedRequest?.bookingId)
    }

    @Test
    fun activeRideActionsDispatchPassengerAndSessionCallbacks() {
        var pickupPassenger: RidePassengerStatus? = null
        var dropoffPassenger: RidePassengerStatus? = null
        var endRideTapped = false

        compose.setSgmUiTestContent {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = { pickupPassenger = it },
                onDropoff = { dropoffPassenger = it },
                onEndRide = { endRideTapped = true },
            )
        }

        val passenger = UiFlowFixtures.activeRide.passengers.first()
        compose.onNodeWithTag(SgmTestTags.ActiveRidePickupAction).performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.ActiveRideDropoffAction).performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).performScrollTo().performClick()

        assertEquals(passenger.bookingId, pickupPassenger?.bookingId)
        assertEquals(passenger.childId, dropoffPassenger?.childId)
        assertTrue(endRideTapped)
    }

    @Test
    fun activeRideStaleLocationShowsSafetyWarning() {
        compose.setSgmUiTestContent {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide.copy(
                    stale = true,
                    vehicleLastUpdateLabel = "Il y a 18 min",
                    childLastUpdateLabel = "Il y a 21 min",
                ),
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
            )
        }

        compose.onNodeWithTag(SgmTestTags.ActiveRideStaleWarning)
            .performScrollTo()
            .assertIsDisplayed()
    }

    @Test
    fun activeRideResumeCardOpensLiveRideAfterAppRefresh() {
        var openedRide = false

        compose.setSgmUiTestContent {
            TripsScreen(
                trips = listOf(UiFlowFixtures.trip),
                activeRide = UiFlowFixtures.activeRide,
                bookingRequests = emptyList(),
                onTripAction = {},
                onOpenSearch = {},
                onOpenRide = { openedRide = true },
                onApproveBooking = {},
            )
        }

        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction)
            .performScrollTo()
            .assertIsDisplayed()
            .performClick()

        assertTrue(openedRide)
    }

    @Test
    fun paymentActionDispatchesSelectedBooking() {
        var paidBooking: PayableBookingSummary? = null

        compose.setSgmUiTestContent {
            PaymentsScreen(
                role = AppRole.Parent,
                bookings = listOf(UiFlowFixtures.payableBooking),
                loading = false,
                onBack = {},
                onPay = { paidBooking = it },
                onStartConnect = {},
            )
        }

        compose.onNodeWithTag(SgmTestTags.PaymentAction).performScrollTo().performClick()
        assertEquals(UiFlowFixtures.payableBooking.bookingId, paidBooking?.bookingId)
    }

    @Test
    fun driverConnectActionDispatchesOnboardingCallback() {
        var connectTapped = false

        compose.setSgmUiTestContent {
            PaymentsScreen(
                role = AppRole.Driver,
                bookings = emptyList(),
                loading = false,
                onBack = {},
                onPay = {},
                onStartConnect = { connectTapped = true },
            )
        }

        compose.onNodeWithTag(SgmTestTags.PaymentConnectAction).performScrollTo().performClick()
        assertTrue(connectTapped)
    }

    @Test
    fun supportReportActionCreatesValidatedReport() {
        val firebase = UiFlowFirebaseGateway()

        compose.setSgmUiTestContent {
            OptionsScreen(firebase = firebase, onBack = {})
        }

        compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput)
            .performScrollTo()
            .performTextInput("Retard au point de rendez-vous avec enfant mineur.")
        compose.onNodeWithTag(SgmTestTags.SupportReportAction).performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 5_000) { firebase.createdReport != null }

        val report = firebase.createdReport
        assertEquals("other", report?.subjectType)
        assertEquals("Sécurité", report?.reason)
        assertEquals(false, report?.emergency)
        assertTrue(report?.description?.contains("enfant mineur") == true)
    }

    @Test
    fun ratingActionSubmitsSelectedReviewScore() {
        val firebase = UiFlowFirebaseGateway()

        compose.setSgmUiTestContent {
            MessagesScreen(firebase = firebase)
        }

        waitUntilTagExists(SgmTestTags.RatingTab)
        compose.onNodeWithTag(SgmTestTags.RatingTab).performClick()
        waitUntilTagExists("${SgmTestTags.RatingPromptAction}.5")
        compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.5").performClick()
        compose.waitUntil(timeoutMillis = 5_000) { firebase.submittedRating != null }

        val rating = firebase.submittedRating
        assertEquals("ride-session-1", rating?.rideSessionId)
        assertEquals("driver-1", rating?.ratedUserId)
        assertEquals(5, rating?.score)
    }

    @Test
    fun rewardsWithdrawRoutesDriverToPayments() {
        var payoutRole: AppRole? = null
        var error: String? = null

        compose.setSgmUiTestContent {
            RewardsRoute(
                summary = UiFlowFixtures.rewards,
                availableRoles = setOf(AppRole.Parent, AppRole.Driver),
                onBack = {},
                onOpenPayments = { payoutRole = it },
                setError = { error = it },
            )
        }

        compose.onNodeWithTag(SgmTestTags.RewardsWithdrawAction).performClick()
        assertEquals(AppRole.Driver, payoutRole)
        assertNull(error)
    }

    @Test
    fun rewardsWithdrawRequiresDriverRole() {
        var payoutRole: AppRole? = null
        var error: String? = null

        compose.setSgmUiTestContent {
            RewardsRoute(
                summary = UiFlowFixtures.rewards,
                availableRoles = setOf(AppRole.Parent),
                onBack = {},
                onOpenPayments = { payoutRole = it },
                setError = { error = it },
            )
        }

        compose.onNodeWithTag(SgmTestTags.RewardsWithdrawAction).performClick()
        assertNull(payoutRole)
        assertEquals("Le retrait des gains nécessite un profil conducteur validé.", error)
    }

    private fun waitUntilTagExists(tag: String) {
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }
}
