package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.filters.SdkSuppress
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.domain.BelgianTripZone
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.YearMonth

@SdkSuppress(minSdkVersion = 29)
class TripHistoryFlowTest {
    @get:Rule val compose = createComposeRule()
    private val terms = TripChangeTerms("2099-12-01T10:00:00Z", null, MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250)
    private val declined = TripChangeHistoryEntry("trip", "a".repeat(64), TripChangeStatus.Declined,
        "2026-10-18T12:00:00Z", terms.departureAt, 400)
    private val withdrawn = declined.copy(proposalId = "b".repeat(64), status = TripChangeStatus.Withdrawn)
    private inner class Gateway : FirebaseGateway by UnconfiguredFirebaseGateway() {
        var pages = 0; var reads = 0
        override suspend fun tripChangeHistory(tripId: String, cursor: String?): TripChangeHistoryPage {
            pages++; return TripChangeHistoryPage(tripId, listOf(if (cursor == null) declined else withdrawn), if (cursor == null) "next" else null)
        }
        override suspend fun reviewTripChange(tripId: String, proposalId: String): TripChangeReview {
            reads++
            val entry = if (proposalId == declined.proposalId) declined else withdrawn
            return TripChangeReview(tripId, proposalId, "c".repeat(64), entry.status, terms, terms.copy(priceCents = 400),
                terms, 2, 0, null, listOf("own-booking"), false, false, false, emptyList(), entry.createdAt,
                "d".repeat(64), null, null, null)
        }
    }

    @Test fun parentPagesAndReopensBothClosedStatesWithoutDecisionOrApplicationActions() {
        val gateway = Gateway()
        compose.setSgmUiTestContent { TripChangeHistoryDialog("parent", AppRole.Parent, "trip", "Trajet du samedi", gateway, {}, {}) }
        waitFor("trip.history.open.${declined.proposalId}")
        compose.onNodeWithTag("trip.history.more").performScrollTo().performClick()
        waitFor("trip.history.open.${withdrawn.proposalId}")
        compose.onNodeWithTag("trip.history.more").assertDoesNotExist()
        assertEquals(2, gateway.pages)
        for (entry in listOf(declined, withdrawn)) {
            if (entry == withdrawn) {
                waitFor("trip.history.more")
                compose.onNodeWithTag("trip.history.more").performScrollTo().performClick()
            }
            compose.onNodeWithTag("trip.history.open.${entry.proposalId}").performScrollTo().performClick()
            waitFor("trip.change.status")
            compose.onNodeWithTag("trip.change.status").assertTextEquals(tripChangeStatusLabel(entry.status))
            for (action in listOf("accept", "decline", "withdraw", "calculate", "apply", "propose"))
                compose.onNodeWithTag("trip.change.$action").assertDoesNotExist()
            compose.onNodeWithContentDescription("Fermer").performClick()
            waitFor("trip.history.title")
        }
        assertEquals(2, gateway.reads)
    }

    @Test fun largeTextHistoryTitleFitsAndClosingDoesNotStartARideOrWriteChanges() {
        val gateway = Gateway(); var dismissed = false
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 2f)) {
                TripChangeHistoryDialog("driver", AppRole.Driver, "trip", "Déplacement de l’équipe du samedi matin", gateway, { fail() }, { dismissed = true })
            }
        }
        waitFor("trip.history.open.${declined.proposalId}")
        assertMeasuredTextFits(reportedTextLayout(compose.onNodeWithTag("trip.history.title")))
        compose.onNodeWithContentDescription("Fermer l’historique").performClick()
        assertTrue(dismissed); assertEquals(0, gateway.reads)
    }

    @Test fun reopeningTwoHistoriesDoesNotAdvanceAnAlreadySelectedMonthAgain() {
        val current = YearMonth.now(BelgianTripZone)
        val trip = UiFlowFixtures.trip.copy(title = "This month", departureAtIso = current.atDay(15).atTime(12, 0).atZone(BelgianTripZone).toInstant().toString())
        val next = trip.copy(id = "history-next", title = "Next month", departureAtIso = current.plusMonths(1).atDay(15).atTime(12, 0).atZone(BelgianTripZone).toInstant().toString())
        compose.setSgmUiTestContent { TripsScreen(listOf(trip, next), null, 0, {}, {}, {}, {}) }
        selectLocalTripMonth(compose, next)
        selectLocalTripMonth(compose, next)
        compose.onNodeWithText("Next month").assertIsDisplayed()
        selectLocalTripMonth(compose, trip)
        compose.onNodeWithText("This month").assertIsDisplayed()
    }

    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
