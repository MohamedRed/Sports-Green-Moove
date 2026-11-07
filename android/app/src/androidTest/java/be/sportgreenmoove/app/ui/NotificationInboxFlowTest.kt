package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.services.NotificationInboxGateway
import be.sportgreenmoove.app.services.NotificationReadGateway
import kotlinx.coroutines.launch
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NotificationInboxFlowTest {
    @get:Rule val compose=createComposeRule()
    private val notice=InboxNotificationSummary("teamChat_qa","Nouveau message d’équipe",
        "Un nouveau message est disponible dans votre équipe.","1 novembre",true,"NM")

    @Test fun aNewAlertArrivesWithoutLeavingOrRefreshingTheOpenList() {
        val gateway=Fixture();show(gateway)
        compose.onNodeWithText("Aucune notification.").assertIsDisplayed()
        compose.runOnIdle { gateway.rows=listOf(notice) }
        waitFor("notification.${notice.id}")
        compose.onNodeWithText(notice.title).assertIsDisplayed()
        compose.onAllNodesWithTag("notification.${notice.id}").assertCountEquals(1)
        captureLocalUi(compose,"notification-inbox-arrived.png")
    }
    @Test fun theNextAuthoritativeReadRemovesARevokedAlertWithoutAnOldHistoryCard() {
        val gateway=Fixture().apply { rows=listOf(notice) };show(gateway);waitFor("notification.${notice.id}")
        compose.runOnIdle { gateway.rows=emptyList() }
        compose.waitForComposeNode(hasText("Aucune notification."), 8_000)
        compose.onNodeWithTag("notification.${notice.id}").assertDoesNotExist()
        captureLocalUi(compose,"notification-inbox-revoked.png")
    }
    @Test fun aFailedReadHidesTheAlertUntilAnExplicitRetryConfirmsItsReturn() {
        val gateway=Fixture().apply { rows=listOf(notice) };show(gateway);waitFor("notification.${notice.id}")
        compose.runOnIdle { gateway.fail=true };waitFor("notification.inbox.retry")
        compose.onNodeWithTag("notification.${notice.id}").assertDoesNotExist()
        captureLocalUi(compose,"notification-inbox-error.png")
        compose.runOnIdle { gateway.fail=false }
        compose.onNodeWithTag("notification.inbox.retry").performClick();waitFor("notification.${notice.id}")
        compose.onAllNodesWithTag("notification.${notice.id}").assertCountEquals(1)
        captureLocalUi(compose,"notification-inbox-recovered.png")
        compose.runOnIdle { gateway.rows=listOf(notice.copy(id="teamChat_after_retry")) }
        waitFor("notification.teamChat_after_retry")
        compose.onNodeWithTag("notification.${notice.id}").assertDoesNotExist()
    }
    @Test fun narrowLargeTextKeepsTheReceivedCardAndReadActionInsideTheList() {
        show(Fixture().apply { rows=listOf(notice) },narrow=true);waitFor("notification.${notice.id}")
        val frame=compose.onNodeWithTag("notification.inbox.frame").fetchSemanticsNode().boundsInRoot
        for(tag in listOf("notification.${notice.id}","notification.read.${notice.id}","notification.status.${notice.id}")) {
            val node=compose.onNodeWithTag(tag,useUnmergedTree=true);node.assertIsDisplayed()
            val bounds=node.fetchSemanticsNode().boundsInRoot;assertTrue(bounds.left>=frame.left&&bounds.right<=frame.right)
        }
        captureLocalUi(compose,"notification-inbox-narrow.png")
    }
    private fun show(gateway:Fixture,narrow:Boolean=false) {
        compose.setSgmUiTestContent {
            val density=LocalDensity.current
            val reads=remember { NotificationReadState("parent",object:NotificationReadGateway {
                override suspend fun markNotificationRead(uid:String,notificationId:String) { error("No read action in this fixture") }
            }) }
            val state=remember { NotificationInboxState("parent",gateway,reads::reconcile) }
            val scope=rememberCoroutineScope()
            LaunchedEffect(state) { state.observe() }
            CompositionLocalProvider(LocalDensity provides Density(density.density,if(narrow)1.5f else density.fontScale)) {
                Box(Modifier.fillMaxSize()) {
                    LazyColumn(Modifier.width(if(narrow)280.dp else 360.dp).testTag("notification.inbox.frame")) {
                        notificationInboxItems(state,reads,onRetry={scope.launch { state.refresh() }}) {}
                    }
                }
            }
        }
    }
    private fun waitFor(tag:String)=compose.waitForComposeNode(hasTestTag(tag), 8_000)
    private class Fixture:NotificationInboxGateway {
        var rows=emptyList<InboxNotificationSummary>();var fail=false
        override suspend fun loadNotificationInbox(uid:String):List<InboxNotificationSummary> { check(!fail);return rows }
    }
}
