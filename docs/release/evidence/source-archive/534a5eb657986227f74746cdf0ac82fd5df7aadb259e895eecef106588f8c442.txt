package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlin.math.ceil
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ReviewTripContextFlowTest {
    @get:Rule val compose = createComposeRule()
    private val longTitle = "Entraînement des équipes de football : déplacement au centre sportif pour la rencontre amicale du week-end et retour au club"
    private fun review(ride: String, label: String, departureAt: String = "2026-10-29T17:45:00Z") =
        InboxReviewPrompt("${ride}_parent_driver", ride, "driver", "Avis de course",
            "Comment s'est passé votre trajet? Donnez votre avis.", "AC", ReviewTripContext(ride, "Entraînement U12", departureAt, label))

    @Test fun sameNamedTripsKeepTheirOwnDateAndOnlyTheSelectedRideIsRated() {
        val first = review("first", "28 octobre 2026 à 18:45", "2026-10-28T17:45:00Z")
        val second = review("second", "29 octobre 2026 à 18:45")
        val base = UiFlowFirebaseGateway()
        val gateway = object : FirebaseGateway by base {
            override suspend fun getInbox() = InboxSummary(reviews = listOf(first, second))
        }
        compose.setSgmUiTestContent { MessagesInboxRoute("parent", gateway, UiFlowConversationGateway(), "avis", {}, {}, {}) }
        compose.waitUntil(10_000) { compose.onAllNodesWithText(second.tripContext!!.departureLabel).fetchSemanticsNodes().isNotEmpty() }
        val canvas = compose.onRoot().fetchSemanticsNode().boundsInRoot
        captureLocalUi(compose, "review-trip-context-choices.png", landscape = canvas.width > canvas.height)
        compose.onAllNodesWithTag("${SgmTestTags.RatingPromptAction}.5").onLast().performScrollTo().performClick()
        compose.waitUntil(10_000) { base.submittedRating != null }
        assertEquals("second", base.submittedRating?.rideSessionId)
        compose.onNodeWithText(first.tripContext!!.departureLabel).assertExists()
        compose.onNodeWithText(second.tripContext!!.departureLabel).assertDoesNotExist()
    }
    @Test fun narrowLargeTextKeepsTheCompleteTripTitleAndDateAndAllFiveChoicesInsideTheCard() {
        val initial = review("wide", "29 octobre 2026 à 18:45")
        val row = initial.copy(tripContext = initial.tripContext!!.copy(title = longTitle))
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.8f)) {
                Box(Modifier.width(280.dp)) { ReviewCard(row, false) {} }
            }
        }
        val frame = compose.onNodeWithTag(SgmTestTags.RatingPromptAction).fetchSemanticsNode().boundsInRoot
        for (tag in listOf("review.trip.title", "review.trip.departure")) {
            val layouts = mutableListOf<TextLayoutResult>()
            compose.onNodeWithTag(tag).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
            val layout = layouts.single()
            for (line in 0 until layout.lineCount) {
                assertFalse(layout.isLineEllipsized(line)); assertTrue(layout.getLineLeft(line) >= 0)
                assertTrue(ceil(layout.getLineRight(line)).toInt() <= layout.size.width)
                assertTrue(ceil(layout.getLineBottom(line)).toInt() <= layout.size.height)
            }
            assertEquals(layout.layoutInput.text.length, layout.getLineEnd(layout.lineCount - 1))
        }
        for (score in 1..5) {
            val bounds = compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.$score").fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right && bounds.bottom <= frame.bottom)
        }
        val canvas = compose.onRoot().fetchSemanticsNode().boundsInRoot
        captureLocalUi(compose, "review-trip-context-large-text.png", landscape = canvas.width > canvas.height)
    }
    @Test fun unavailableDetailsNeverInventADateAndSendingStillDisablesAllScores() {
        val row = review("missing", "29 octobre 2026 à 18:45").copy(tripContext = null)
        compose.setSgmUiTestContent { ReviewCard(row, true) { fail("A sending review must not submit twice") } }
        compose.onNodeWithText("Détails du trajet indisponibles").assertIsDisplayed()
        compose.onNodeWithTag("review.trip.departure").assertDoesNotExist()
        for (score in 1..5) compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.$score").assertIsNotEnabled()
        val canvas = compose.onRoot().fetchSemanticsNode().boundsInRoot
        captureLocalUi(compose, "review-trip-context-unavailable.png", landscape = canvas.width > canvas.height)
    }
}
