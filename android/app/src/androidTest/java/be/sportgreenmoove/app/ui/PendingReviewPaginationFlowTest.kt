package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import be.sportgreenmoove.app.data.InboxReviewPrompt
import be.sportgreenmoove.app.data.InboxSummary
import be.sportgreenmoove.app.data.PendingReviewPage
import be.sportgreenmoove.app.services.FirebaseGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class PendingReviewPaginationFlowTest {
    @get:Rule val compose = createComposeRule()
    private fun review(id: String) = InboxReviewPrompt(id, id, "driver", "Avis de course", "Notez le trajet.", "AV")

    @Test fun emptyRatedPagesContinueToARealReviewAndSubmissionRemovesItWithoutResettingTheList() {
        val base = UiFlowFirebaseGateway()
        val firebase = object : FirebaseGateway by base {
            override suspend fun getInbox() = InboxSummary(reviewsNextCursor = "one")
            override suspend fun loadPendingReviews(cursor: String) = if (cursor == "one")
                PendingReviewPage("parent", emptyList(), "two") else PendingReviewPage("parent", listOf(review("late")), null)
        }
        show(firebase); waitForText("Continuer la recherche")
        compose.onNodeWithText("Aucun avis en attente.").assertDoesNotExist()
        compose.onNodeWithTag("messages.reviews.more").performClick(); waitForText("Continuer la recherche")
        compose.onNodeWithText("Aucun avis en attente.").assertDoesNotExist()
        compose.onNodeWithTag("messages.reviews.more").performClick(); waitForText("Avis de course")
        compose.onNodeWithTag("${SgmTestTags.RatingPromptAction}.5").performClick()
        waitForText("Avis envoyé."); waitForText("Aucun avis en attente.")
        assertEquals("late", base.submittedRating?.rideSessionId)
        compose.onNodeWithTag("messages.reviews.more").assertDoesNotExist()
    }
    @Test fun pageFailureKeepsVisibleReviewsAndAnExplicitRetryCanReachTheEnd() {
        var fail = true
        val firebase = object : FirebaseGateway by UiFlowFirebaseGateway() {
            override suspend fun getInbox() = InboxSummary(reviews = listOf(review("first")), reviewsNextCursor = "one")
            override suspend fun loadPendingReviews(cursor: String): PendingReviewPage {
                if (fail) error("Isolated page failure")
                return PendingReviewPage("parent", emptyList(), null)
            }
        }
        show(firebase); waitForText("Voir d’autres avis")
        compose.onNodeWithTag("messages.reviews.more").performClick(); compose.waitForIdle()
        compose.onNodeWithText("Avis de course").assertIsDisplayed()
        compose.onNodeWithText("Aucun avis en attente.").assertDoesNotExist()
        compose.runOnIdle { fail = false }
        compose.onNodeWithTag("messages.reviews.more").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithTag("messages.reviews.more").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("Avis de course").assertIsDisplayed()
    }
    @Test fun changingAccountsClearsThePriorAccountsPendingPage() {
        var uid by mutableStateOf("parent")
        val first = object : FirebaseGateway by UiFlowFirebaseGateway() {
            override suspend fun getInbox() = InboxSummary(reviews = listOf(review("first")), reviewsNextCursor = "one")
        }
        val empty = object : FirebaseGateway by UiFlowFirebaseGateway() {
            override suspend fun getInbox() = InboxSummary()
        }
        val conversations = UiFlowConversationGateway()
        compose.setSgmUiTestContent {
            MessagesInboxRoute(uid, if (uid == "parent") first else empty, conversations, "avis", {}, {}, {})
        }
        waitForText("Voir d’autres avis")
        compose.runOnIdle { uid = "other" }; waitForText("Aucun avis en attente.")
        compose.onNodeWithText("Avis de course").assertDoesNotExist()
        compose.onNodeWithTag("messages.reviews.more").assertDoesNotExist()
    }
    private fun show(firebase: FirebaseGateway) {
        val conversations = UiFlowConversationGateway()
        compose.setSgmUiTestContent { MessagesInboxRoute("parent", firebase, conversations, "avis", {}, {}, {}) }
    }
    private fun waitForText(text: String) = compose.waitUntil(5_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
}
