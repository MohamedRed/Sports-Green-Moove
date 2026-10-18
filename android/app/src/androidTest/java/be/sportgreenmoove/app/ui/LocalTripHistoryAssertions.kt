package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import be.sportgreenmoove.app.data.TripSummary

internal class LocalTripHistoryAssertions(private val compose: ComposeTestRule) {
    fun parent(bookingId: String, proposalId: String, kind: String, capture: Boolean) {
        compose.onNodeWithTag("reservation.history.$bookingId").performScrollTo().assertIsEnabled().performClick()
        review(proposalId, kind, capture)
    }
    fun driver(trip: TripSummary, proposalId: String, kind: String) {
        selectLocalTripMonth(compose, trip)
        compose.onNodeWithTag("trip.history.${trip.id}").performScrollTo().assertIsEnabled().performClick()
        review(proposalId, kind, capture = false)
    }
    private fun review(proposalId: String, kind: String, capture: Boolean) {
        ready()
        compose.onNodeWithTag("trip.history.open.$proposalId").performScrollTo().assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.status").fetchSemanticsNodes().isNotEmpty() }
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.status").assertTextEquals(if (kind == "declined")
            "Modification refusée, trajet initial conservé" else "Proposition retirée, trajet initial conservé")
        for (action in listOf("accept", "decline", "withdraw", "calculate", "apply", "propose"))
            compose.onNodeWithTag("trip.change.$action").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.original").performScrollTo().assert(hasAnyDescendant(hasText("2,50 EUR / place")))
        compose.onNodeWithTag("trip.change.proposed").performScrollTo().assert(hasAnyDescendant(hasText("4,00 EUR / place")))
        if (capture) {
            compose.onNodeWithTag("trip.change.status").performScrollTo()
            captureLocalUi(compose, "local-trip-history-$kind.png", dialog = true)
        }
        compose.onNodeWithContentDescription("Fermer", useUnmergedTree = true).assertIsEnabled().performClick()
        ready()
        compose.onNodeWithContentDescription("Fermer l’historique", useUnmergedTree = true).assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.history.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun ready() {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.history.title").fetchSemanticsNodes().isNotEmpty() }
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.history.busy").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithTag("trip.history.error").assertDoesNotExist()
    }
}
