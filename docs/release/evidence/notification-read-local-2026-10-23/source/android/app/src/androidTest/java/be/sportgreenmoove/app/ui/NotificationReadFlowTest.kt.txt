package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.services.NotificationReadGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NotificationReadFlowTest {
    @get:Rule val compose = createComposeRule()
    private val note = InboxNotificationSummary("qa", "Réservation confirmée", "Deux places pour le prochain entraînement.", "Aujourd’hui", true, "QA")

    @Test fun acknowledgementWaitsForTheServerThenRemovesItsAction() {
        val gate = CompletableDeferred<Unit>(); var calls = 0
        val gateway = object : NotificationReadGateway {
            override suspend fun markNotificationRead(uid: String, notificationId: String) { calls++; gate.await() }
        }
        val state = NotificationReadState("parent", gateway)
        show(state)
        capture("unread")
        compose.onNodeWithTag("notification.read.qa").performClick()
        compose.onNodeWithText("Aujourd’hui · Confirmation...").assertIsDisplayed()
        compose.onNodeWithTag("notification.read.qa").assertIsNotEnabled()
        compose.runOnIdle { assertEquals(1, calls); gate.complete(Unit) }
        compose.waitUntil { compose.onAllNodesWithText("Aujourd’hui · Lue").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("notification.read.qa").assertDoesNotExist()
        capture("confirmed")
    }
    @Test fun failedAcknowledgementKeepsAnExplicitRetryAndDoesNotClaimRead() {
        var fail = true; var calls = 0
        val state = NotificationReadState("parent", object : NotificationReadGateway {
            override suspend fun markNotificationRead(uid: String, notificationId: String) { calls++; check(!fail) }
        })
        show(state); compose.onNodeWithTag("notification.read.qa").performClick()
        compose.onNodeWithTag("notification.error.qa").assertIsDisplayed()
        compose.onNodeWithText("Aujourd’hui · Non lue").assertIsDisplayed()
        capture("unconfirmed")
        compose.runOnIdle { fail = false }
        compose.onNodeWithTag("notification.read.qa").performClick()
        compose.onNodeWithText("Aujourd’hui · Lue").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, calls) }
    }
    @Test fun narrowLargeTextKeepsNoticeErrorAndReadActionInsideItsFrame() {
        val state = NotificationReadState("parent", object : NotificationReadGateway {
            override suspend fun markNotificationRead(uid: String, notificationId: String) = error("Synthetic offline")
        })
        show(state, narrow = true); compose.onNodeWithTag("notification.read.qa").performClick()
        val frame = compose.onNodeWithTag("notification.frame").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("notification.qa", "notification.read.qa", "notification.status.qa", "notification.error.qa")) {
            val node = compose.onNodeWithTag(tag, useUnmergedTree = true); node.assertIsDisplayed()
            val bounds = node.fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        }
        val status = compose.onNodeWithTag("notification.status.qa", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val error = compose.onNodeWithTag("notification.error.qa", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        assertTrue(error.top >= status.bottom)
        capture("narrow-error")
    }
    private fun show(state: NotificationReadState, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            val scope = rememberCoroutineScope(); val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, if (narrow) 1.5f else density.fontScale)) {
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.width(if (narrow) 280.dp else 360.dp).testTag("notification.frame")) {
                        NotificationCard(state.display(note), state.pendingId != null, state.pendingId == note.id, state.errors[note.id]) {
                            scope.launch { state.markRead(note) }
                        }
                    }
                }
            }
        }
    }
    private fun capture(phase: String) {
        val stem = "notification-read-$phase"
        captureLocalUi(compose, "$stem.png")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val device = UiDevice.getInstance(instrumentation)
        check(device.takeScreenshot(File(directory, "$stem-window.png")))
        check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-notification-read").isBlank())
        for (suffix in listOf(".png", "-window.png")) {
            val file = File(directory, stem + suffix)
            check(device.executeShellCommand("cp ${file.absolutePath} /sdcard/Download/sgm-notification-read/${file.name}").isBlank())
        }
    }
}
