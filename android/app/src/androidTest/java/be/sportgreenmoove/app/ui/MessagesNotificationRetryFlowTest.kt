package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class MessagesNotificationRetryFlowTest {
    @get:Rule val compose=createComposeRule()

    @Test fun theActualInboxRetryKeepsReviewPagesDirectoryAndConfirmedReadThenReceivesTheNextAlert() {
        val fixture=Fixture()
        compose.setSgmUiTestContent {
            var selected by remember { mutableStateOf("avis") }
            MessagesInboxRoute("parent",fixture,fixture.conversations,selected,{selected=it},{},{})
        }
        waitForText("Premier avis QA")
        compose.onNodeWithTag("messages.reviews.more").performScrollTo().performClick()
        waitForText("Second avis QA")
        compose.onNodeWithText("NOTIFS").performClick();waitForTag("notification.teamChat_retry")
        compose.onNodeWithTag("notification.read.teamChat_retry").performClick()
        compose.waitForComposeNode(hasText("1 novembre · Lue"), 5_000)
        compose.runOnIdle { fixture.fail=true }
        waitForTag("notification.inbox.retry")
        compose.onNodeWithTag("notification.teamChat_retry").assertDoesNotExist()
        var before=0;compose.runOnIdle { before=fixture.notificationCalls }
        compose.onNodeWithTag("notification.inbox.retry").performClick()
        compose.waitUntil(5_000) { fixture.notificationCalls>before }
        compose.onNodeWithTag("notification.teamChat_retry").assertDoesNotExist()
        compose.onNodeWithText("Aucune notification.").assertDoesNotExist()
        compose.runOnIdle { fixture.fail=false }
        compose.onNodeWithTag("notification.inbox.retry").performClick();waitForTag("notification.teamChat_retry")
        compose.onNodeWithTag("notification.status.teamChat_retry",useUnmergedTree=true).assertTextEquals("1 novembre · Lue")
        compose.runOnIdle { fixture.rows=listOf(fixture.notice.copy(id="teamChat_after_retry")) }
        waitForTag("notification.teamChat_after_retry")
        compose.onNodeWithTag("notification.teamChat_retry").assertDoesNotExist()
        compose.runOnIdle { assertEquals(1,fixture.metadataCalls);assertEquals(1,fixture.directoryCalls) }
        compose.onNodeWithTag(SgmTestTags.RatingTab).performClick();waitForText("Second avis QA")
        compose.onNodeWithTag("messages.reviews.more").assertDoesNotExist()
        compose.onNodeWithText("Premier avis QA").assertExists()
    }
    private fun waitForTag(tag:String)=compose.waitForComposeNode(hasTestTag(tag), 8_000)
    private fun waitForText(text:String)=compose.waitForComposeNode(hasText(text), 5_000)

    private class Fixture:FirebaseGateway by UnconfiguredFirebaseGateway() {
        val notice=InboxNotificationSummary("teamChat_retry","Message d’équipe QA","Message disponible.","1 novembre",true,"QA")
        var rows=listOf(notice);var fail=false;var metadataCalls=0;var directoryCalls=0
        @Volatile var notificationCalls=0
        override suspend fun getInbox():InboxSummary {
            metadataCalls++;return InboxSummary(reviews=listOf(review("first","Premier avis QA")),reviewsNextCursor="next")
        }
        override suspend fun loadPendingReviews(cursor:String)=PendingReviewPage("parent",listOf(review("second","Second avis QA")),null)
        override suspend fun loadNotificationInbox(uid:String):List<InboxNotificationSummary> { notificationCalls++;check(!fail);return rows }
        override suspend fun markNotificationRead(uid:String,notificationId:String) {}
        val conversations=object:ConversationGateway by UnconfiguredConversationGateway() {
            override fun observeInboxChanges()=flow<Unit> { awaitCancellation() }
            override suspend fun loadConversations(cursor:String?):ConversationDirectoryPage {
                directoryCalls++;return ConversationDirectoryPage(emptyList(),null,null,null)
            }
        }
        private fun review(id:String,title:String)=InboxReviewPrompt(id,id,"driver",title,"Votre avis ?","AV")
    }
}
