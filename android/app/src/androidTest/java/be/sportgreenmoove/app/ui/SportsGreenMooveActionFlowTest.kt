package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripMatchSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SportsGreenMooveActionFlowTest {
    @get:Rule
    val compose = createComposeRule()

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
    fun bookingApprovalActionDispatchesSelectedRequest() {
        var approvedRequest: BookingRequestSummary? = null

        compose.setSgmUiTestContent {
            BookingRequestsList(
                requests = listOf(UiFlowFixtures.bookingRequest),
                onApprove = { approvedRequest = it },
            )
        }

        compose.onNodeWithTag(SgmTestTags.BookingApproveAction).performScrollTo().performClick()
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

        compose.onNodeWithText("Continuer l'onboarding").performScrollTo().performClick()
        assertTrue(connectTapped)
    }
}
