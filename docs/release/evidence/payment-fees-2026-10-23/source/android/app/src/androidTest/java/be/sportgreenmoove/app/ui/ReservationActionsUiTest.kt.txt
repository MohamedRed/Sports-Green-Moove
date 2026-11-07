package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationPage
import be.sportgreenmoove.app.services.ReservationGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ReservationActionsUiTest {
    @get:Rule val compose = createComposeRule()
    @Test fun parentCancellationRequiresConfirmationAndFitsTheNarrowContentColumn() {
        val pending = UiFlowFixtures.reservation.copy(allowedActions = setOf(ReservationDecision.Cancel))
        var current = pending
        val writes = mutableListOf<ReservationDecision>()
        val gateway = object : ReservationGateway {
            override suspend fun list(role: AppRole, cursor: String?) = ReservationPage(listOf(current), null)
            override suspend fun decide(bookingId: String, decision: ReservationDecision) {
                assertEquals(pending.booking.bookingId, bookingId)
                writes += decision
                current = pending.copy(booking = pending.booking.copy(status = "cancelled"), allowedActions = emptySet())
            }
        }
        compose.setSgmUiTestContent {
            Column(Modifier.width(320.dp).testTag("narrow.host").verticalScroll(rememberScrollState())) {
                ReservationManagementRoute("parent-qa", AppRole.Parent, gateway, UiFlowFirebaseGateway()) {}
            }
        }
        val cancel = decisionTag(ReservationDecision.Cancel, pending.booking.bookingId)
        compose.waitUntil(10_000) { compose.onAllNodesWithTag(cancel).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(cancel).performScrollTo().assertIsDisplayed()
        val host = compose.onNodeWithTag("narrow.host").fetchSemanticsNode().boundsInRoot
        val action = compose.onNodeWithTag(cancel).fetchSemanticsNode().boundsInRoot
        assertTrue(action.left >= host.left && action.right <= host.right)
        compose.onNodeWithTag(cancel).performClick()
        compose.onNodeWithText("${pending.booking.title}\n1 place\nCette action ne confirme pas de remboursement.").assertIsDisplayed()
        compose.onNodeWithTag("bookings.keep").performClick()
        assertTrue(writes.isEmpty())
        compose.onNodeWithTag(cancel).performClick()
        compose.onNodeWithTag("bookings.confirm").performClick()
        compose.waitUntil(10_000) { writes.size == 1 }
        compose.onNodeWithTag("reservation.status.${pending.booking.bookingId}").assertTextEquals("Annulée")
        compose.onNodeWithTag(cancel).assertDoesNotExist()
        assertEquals(listOf(ReservationDecision.Cancel), writes)
    }
    @Test fun busyDriverRowsDisableBothDecisions() {
        compose.setSgmUiTestContent { BookingRequestsList(listOf(UiFlowFixtures.reservation), true) { _, _ -> fail() } }
        for (decision in listOf(ReservationDecision.Approve, ReservationDecision.Decline)) {
            compose.onNodeWithTag(decisionTag(decision, UiFlowFixtures.bookingRequest.bookingId)).assertIsNotEnabled()
        }
    }
    @Test fun approvingOneBookingDoesNotDependOnOtherApprovedBookings() {
        val pending = UiFlowFixtures.reservation.copy(booking = UiFlowFixtures.bookingRequest.copy(bookingId = "chosen-booking", status = "requested"),
            allowedActions = setOf(ReservationDecision.Approve))
        val approved = (1..3).map { index -> pending.copy(booking = pending.booking.copy(bookingId = "other-$index", status = "approved"),
            allowedActions = emptySet()) }
        var rows = approved + pending
        val writes = mutableListOf<String>()
        val gateway = object : ReservationGateway {
            override suspend fun list(role: AppRole, cursor: String?) = ReservationPage(rows, null)
            override suspend fun decide(bookingId: String, decision: ReservationDecision) {
                assertEquals("chosen-booking", bookingId); assertEquals(ReservationDecision.Approve, decision)
                writes += bookingId
                rows = rows.map { row -> if (row.booking.bookingId == bookingId)
                    row.copy(booking = row.booking.copy(status = "approved"), allowedActions = emptySet()) else row }
            }
        }
        compose.setSgmUiTestContent {
            Column(Modifier.width(320.dp).verticalScroll(rememberScrollState())) {
                ReservationManagementRoute("driver-qa", AppRole.Driver, gateway, UiFlowFirebaseGateway()) {}
            }
        }
        val action = decisionTag(ReservationDecision.Approve, "chosen-booking")
        compose.waitUntil(10_000) { compose.onAllNodesWithTag(action).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(action).performScrollTo().performClick()
        compose.onNodeWithTag("bookings.confirm").performClick()
        compose.waitUntil(10_000) {
            runCatching { compose.onNodeWithTag("reservation.status.chosen-booking").assertTextEquals("Approuvée") }.isSuccess
        }
        compose.onNodeWithTag(action).assertDoesNotExist()
        for (index in 1..3) compose.onNodeWithTag("reservation.status.other-$index").assertTextEquals("Approuvée")
        assertEquals(listOf("chosen-booking"), writes)
    }
}
