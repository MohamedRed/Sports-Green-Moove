package be.sportgreenmoove.app.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.data.ReservationPage
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.domain.BookingReplyUnconfirmedException
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.ReservationGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredReservationGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class DirectBookingConfirmationTest {
    @get:Rule val compose = createComposeRule()
    private val trip = UiFlowFixtures.match.summary
    private var requests = 0
    private var loseReply = false
    private var booked = false
    private lateinit var state: DirectBookingState

    @Test fun onlyExplicitConfirmationSendsAndReopeningFindsTheExistingRequest() {
        host()
        compose.onNodeWithTag("booking.direct.confirm").assertIsEnabled()
        compose.runOnIdle { assertEquals(0, requests) }
        compose.onNodeWithTag("booking.direct.confirm").performClick()
        compose.onNodeWithText("Demande envoyée.").assertIsDisplayed()
        compose.onNodeWithTag("booking.direct.confirm").assertDoesNotExist()
        compose.onNodeWithTag("booking.direct.dismiss").performClick()
        compose.runOnIdle { state.open(trip) }
        compose.onNodeWithText("Votre demande est en attente.").assertIsDisplayed()
        compose.onNodeWithTag("booking.direct.confirm").assertDoesNotExist()
        compose.runOnIdle { assertEquals(1, requests) }
    }

    @Test fun largeTextRetainsTheExplicitRetryWithoutPretendingTheReplyWasConfirmed() {
        loseReply = true
        host(fontScale = 1.5f)
        compose.onNodeWithTag("booking.direct.confirm").performClick()
        val label = compose.onNodeWithText("Réessayer la même demande")
        val bounds = label.assertIsDisplayed().fetchSemanticsNode().boundsInRoot
        val dialog = compose.onNode(isDialog()).fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= dialog.left && bounds.right <= dialog.right)
        assertMeasuredTextFits(reportedTextLayout(label))
        compose.onNodeWithTag("booking.direct.confirmed").assertDoesNotExist()
        compose.runOnIdle { assertEquals(1, requests); loseReply = false }
        label.performClick()
        compose.onNodeWithText("Demande envoyée.").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, requests) }
    }

    private fun host(fontScale: Float = 1f) {
        val firebase = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun searchTrips() = listOf(trip)
            override suspend fun requestBooking(trip: TripSummary, childId: String?, seats: Int): String {
                requests++
                if (loseReply) throw BookingReplyUnconfirmedException(IllegalStateException("unavailable"))
                booked = true
                return "booking"
            }
        }
        val reservations = object : ReservationGateway by UnconfiguredReservationGateway() {
            override suspend fun list(role: AppRole, cursor: String?) = ReservationPage(if (booked) listOf(
                ReservationItem(BookingRequestSummary("booking", trip.id, "parent", null, null, 1, null,
                    "requested", trip.title, trip.club, trip.dateLabel, trip.timeLabel, trip.priceLabel), emptySet(), false),
            ) else emptyList(), null)
        }
        compose.setSgmUiTestContent {
            val scope = rememberCoroutineScope()
            state = remember { DirectBookingState("parent", firebase, reservations, scope) { "parent" } }
            LaunchedEffect(state) { state.open(trip) }
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) { DirectBookingDialog(state) }
        }
    }
}
