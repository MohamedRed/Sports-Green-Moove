package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

internal fun awaitRecordedTripAgreement(compose: ComposeTestRule, acceptedParentCount: Int, parentCount: Int) {
    // The first agreement keeps the pending status; only its acknowledgement proves completion.
    compose.waitUntil(60_000) {
        compose.onAllNodesWithTag("trip.change.decision").fetchSemanticsNodes().isNotEmpty() &&
            compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty()
    }
    compose.onNodeWithTag("trip.change.decision").performScrollTo().assertTextEquals("Votre accord est enregistré.")
    compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : $acceptedParentCount / $parentCount")
    compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
    compose.onNodeWithTag("trip.change.accept").assertDoesNotExist()
    compose.onNodeWithTag("trip.change.decline").assertDoesNotExist()
}
