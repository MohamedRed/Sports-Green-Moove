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
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.PendingReviewPage
import be.sportgreenmoove.app.data.ReviewTripContext
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.IOException

class ReviewSubmissionRecoveryFlowTest {
    @get:Rule val compose = createComposeRule()
    private val older = review("older", "28 octobre 2026 à 18:45")
    private val later = review("later", "29 octobre 2026 à 18:45")
    private fun review(id: String, date: String) = InboxReviewPrompt(id, id, "driver", "Avis de course",
        "Comment s'est passé votre trajet? Donnez votre avis.", "AV",
        ReviewTripContext(id, "Entraînement U12", "2026-10-29T17:45:00Z", date))

    @Test fun failedSubmissionKeepsTheExpandedTripContextAndRetryOnlyRemovesTheSelectedTrip() {
        var inboxLoads = 0
        val releaseFirstFailure = CompletableDeferred<Unit>()
        val attempts = mutableListOf<SubmittedRating>()
        val gateway = object : FirebaseGateway by UiFlowFirebaseGateway() {
            override suspend fun getInbox(): InboxSummary {
                inboxLoads++
                return InboxSummary(reviews = listOf(older), reviewsNextCursor = "later")
            }
            override suspend fun loadPendingReviews(cursor: String) = PendingReviewPage("parent", listOf(later), null)
            override suspend fun submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?): String {
                attempts += SubmittedRating(rideSessionId, ratedUserId, score, comment)
                if (attempts.size == 1) {releaseFirstFailure.await(); throw IOException("network unavailable")}
                return "acknowledged-later-rating"
            }
        }
        compose.setSgmUiTestContent { MessagesInboxRoute("parent", gateway, UiFlowConversationGateway(), "avis", {}, {}, {}) }
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("messages.reviews.more").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("messages.reviews.more").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText(later.tripContext!!.departureLabel).fetchSemanticsNodes().isNotEmpty() }
        val loadedInboxCount = inboxLoads
        compose.onAllNodesWithTag("${SgmTestTags.RatingPromptAction}.5").onLast().performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Envoi de l'avis...").fetchSemanticsNodes().size == 1 }
        for (score in 1..5) {
            compose.onAllNodesWithTag("${SgmTestTags.RatingPromptAction}.$score").onFirst().assertIsNotEnabled()
            compose.onAllNodesWithTag("${SgmTestTags.RatingPromptAction}.$score").onLast().assertIsNotEnabled()
        }
        compose.runOnIdle { releaseFirstFailure.complete(Unit) }
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Connexion réseau indisponible. Vérifiez votre connexion puis réessayez.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(later.tripContext!!.departureLabel).performScrollTo().assertIsDisplayed()
        captureLocalUi(compose, "review-submission-network-failed.png")
        compose.onAllNodesWithTag("${SgmTestTags.RatingPromptAction}.5").onLast().performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Avis envoyé.").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(older.tripContext!!.departureLabel).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(later.tripContext!!.departureLabel).assertDoesNotExist()
        compose.onNodeWithTag("messages.reviews.more").assertDoesNotExist()
        assertEquals(loadedInboxCount, inboxLoads)
        assertEquals(listOf(SubmittedRating("later", "driver", 5, null), SubmittedRating("later", "driver", 5, null)), attempts)
        captureLocalUi(compose, "review-submission-network-recovered.png")
    }

    @Test fun narrowLargeTextKeepsTheFailureAndAllFiveRetryChoicesInsideTheReview() {
        val error = "Connexion réseau indisponible. Vérifiez votre connexion puis réessayez."
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.8f)) {
                Box(Modifier.width(280.dp)) { ReviewCard(later, false, error) {} }
            }
        }
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithTag("review.submission.error").assertIsDisplayed()
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        val layout = layouts.single()
        assertEquals(error.length, layout.getLineEnd(layout.lineCount - 1))
        assertFalse(layout.hasVisualOverflow)
        val frame = compose.onNodeWithTag(SgmTestTags.RatingPromptAction).fetchSemanticsNode().boundsInRoot
        for (score in 1..5) {
            val bounds = compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.$score").assertIsDisplayed().fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right && bounds.bottom <= frame.bottom)
        }
        captureLocalUi(compose, "review-submission-network-large-text.png")
    }
}
