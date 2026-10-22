package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
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
                items = listOf(UiFlowFixtures.reservation), busy = false,
                onDecision = { item, decision ->
                    assertEquals(be.sportgreenmoove.app.data.ReservationDecision.Approve, decision)
                    approvedRequest = item.booking
                },
            )
        }

        compose.onNodeWithTag("${SgmTestTags.BookingApproveAction}.${UiFlowFixtures.bookingRequest.bookingId}").performClick()
        assertEquals(UiFlowFixtures.bookingRequest.bookingId, approvedRequest?.bookingId)
    }

    @Test
    fun activeRideActionsDispatchPassengerAndSessionCallbacks() {
        var pickupPassenger: RidePassengerStatus? = null
        var dropoffPassenger: RidePassengerStatus? = null
        var endRideTapped = false
        var emergencyTapped = false
        val ride = mutableStateOf(UiFlowFixtures.activeRide)

        compose.setSgmUiTestContent {
            RideMonitorScreen(
                activeRide = ride.value,
                canManageRide = true,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = { passenger ->
                    pickupPassenger = passenger
                    ride.value = ride.value.copy(passengers = listOf(passenger.copy(pickupStatus = "pickedUp")))
                },
                onDropoff = { passenger ->
                    dropoffPassenger = passenger
                    ride.value = ride.value.copy(passengers = listOf(passenger.copy(dropoffStatus = "droppedOff")))
                },
                onEndRide = { endRideTapped = true },
                onEmergencyContact = { emergencyTapped = true },
            )
        }

        val passenger = UiFlowFixtures.activeRide.passengers.first()
        compose.onNodeWithTag(SgmTestTags.EmergencyContact).performScrollTo().assertIsEnabled().performClick()
        assertTrue(emergencyTapped)
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
                canManageRide = true,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
                onEmergencyContact = {},
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
                pendingCount = 0,
                onTripAction = {},
                onOpenSearch = {},
                onOpenRide = { openedRide = true },
                reservationContent = {},
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
            OptionsScreen(firebase = firebase, onBack = {}, onEmergencyContact = {}, onSupport = {})
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
            MessagesScreen(firebase = firebase, conversations = UiFlowConversationGateway())
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
