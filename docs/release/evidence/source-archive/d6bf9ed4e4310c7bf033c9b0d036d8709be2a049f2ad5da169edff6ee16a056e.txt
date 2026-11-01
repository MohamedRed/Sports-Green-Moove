package be.sportgreenmoove.app.ui

import android.content.res.Configuration
import android.provider.Settings
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.SgmTheme
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class TeamPushOpenFlowTest {
    @get:Rule val compose = createComposeRule()
    private val request = TeamPushOpenRequest("teamChat_" + "a".repeat(64), "parent", 1)
    private val target = TeamConversationTarget("team", "b".repeat(64))
    private fun alerts(read: suspend () -> TeamConversationTarget?) = object : TeamPushAlertGateway {
        override suspend fun open(request: TeamPushOpenRequest) = read()
    }
    @Test fun pendingAuthorityKeepsBothMessageAndComposerHidden() {
        val hold = CompletableDeferred<TeamConversationTarget?>(); host(alerts { hold.await() })
        waitFor(hasText("Ouverture de la notification...")); privateContentAbsent()
        compose.runOnIdle { hold.complete(null) }; waitFor(hasText("Cette notification n’est plus disponible.")); privateContentAbsent()
    }
    @Test fun explicitRetryNeedsANewReceiptBeforeOpeningTheActualTeamRoute() {
        var calls = 0
        host(alerts { if (++calls == 1) error("Synthetic read failure") else target })
        waitFor(hasTestTag("team-alert.retry")); privateContentAbsent()
        compose.onNodeWithTag("team-alert.retry").performClick()
        waitFor(hasText("Message après admission QA")); compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, calls) }
    }
    @Test fun accountSwitchRejectsThePreviousParentsLateReceipt() {
        val hold = CompletableDeferred<TeamConversationTarget?>(); var uid by mutableStateOf("parent"); var calls = 0
        val gateway = alerts { calls++; hold.await() }
        compose.setSgmUiTestContent { TeamPushOpenRoute(request, uid, true, gateway, conversations()) {} }
        waitFor(hasText("Ouverture de la notification..."))
        compose.runOnIdle { uid = "driver"; hold.complete(target) }
        waitFor(hasText("Cette notification n’est plus disponible.")); privateContentAbsent()
        compose.runOnIdle { assertEquals(1, calls) }
    }
    @Test fun childAccountCannotReachTheResolverOrTheConversation() {
        host(alerts { error("Must not resolve for a child") }, adult = false)
        waitFor(hasText("Cette notification n’est plus disponible.")); privateContentAbsent()
    }
    @Test fun anotherTapOfTheSameAlertRequiresAnotherReceiptInsteadOfReusingTheVisibleThread() {
        var attempt by mutableStateOf(0L); var calls = 0; val hold = CompletableDeferred<TeamConversationTarget?>()
        val gateway = alerts { if (++calls == 1) target else hold.await() }
        compose.setSgmUiTestContent { TeamPushOpenRoute(request, "parent", true, gateway, conversations(), attempt) {} }
        waitFor(hasText("Message après admission QA")); compose.runOnIdle { attempt++ }
        waitFor(hasText("Ouverture de la notification...")); privateContentAbsent()
        compose.runOnIdle { hold.complete(null) }; waitFor(hasText("Cette notification n’est plus disponible.")); privateContentAbsent()
        compose.runOnIdle { assertEquals(2, calls) }
    }
    @Test fun rootSelectsMessagesForAnAlertAndLeavingItClearsTheAlertContext() {
        var opened by mutableStateOf(true)
        val providers = AndroidProviderSet(
            auth = object : AuthGateway by UnconfiguredAuthGateway() {
                override val isConfigured = true
                override suspend fun currentSession() = AuthSession(request.uid, null, "Parent QA")
            },
            firebase = object : FirebaseGateway by UiFlowFirebaseGateway() { override suspend fun getActiveRide(): LiveRideSnapshot? = null },
            teamConversations = conversations(), teamPushAlerts = alerts { target },
        )
        compose.setContent { SportsGreenMooveApp(teamAlertRequest = request.takeIf { opened }, onTeamAlertConsumed = { opened = false }) { providers } }
        waitFor(hasText("Message après admission QA"))
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).assertIsSelected()
        compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).assertIsNotSelected().performClick()
        waitFor(hasTestTag(SgmTestTags.HomeScreen)); compose.runOnIdle { assertFalse(opened) }
        privateContentAbsent(); compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).assertIsSelected()
    }
    @Test fun narrowLargeTextRetryScreenFitsItsFrame() = frame(false, "team-alert-retry-narrow.png")
    @Test fun wideDarkUnavailableScreenFitsItsActualLandscapeFrame() {
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        val rotation = Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0)
        try {
            device.setOrientationLeft()
            compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE }
            frame(true, "team-alert-unavailable-wide-dark.png")
        } finally {
            device.setOrientationNatural()
            compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
            instrumentation.waitForIdleSync(); if (rotation != 0) device.unfreezeRotation()
        }
    }
    private fun frame(dark: Boolean, capture: String) {
        val gateway = alerts { if (dark) null else error("Synthetic read failure") }
        compose.setContent { SgmTheme(darkTheme = dark) { V2ThemeToggleProvider(darkTheme = dark, onToggle = {}) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                Box(Modifier.width(if (dark) 600.dp else 280.dp).sgmTestTag("team-alert.frame")) {
                    TeamPushOpenRoute(request, "parent", true, gateway, conversations()) {}
                }
            }
        } } }
        waitFor(if (dark) hasText("Cette notification n’est plus disponible.") else hasTestTag("team-alert.retry"))
        val frame = compose.onNodeWithTag("team-alert.frame").fetchSemanticsNode().boundsInRoot
        if (dark) assertTrue(frame.width > frame.height)
        for (tag in if (dark) listOf("team-alert.status") else listOf("team-alert.status", "team-alert.retry")) {
            val node = compose.onNodeWithTag(tag); node.assertIsDisplayed(); val bounds = node.fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        }
        captureLocalUi(compose, capture, landscape = frame.width > frame.height)
    }
    private fun host(gateway: TeamPushAlertGateway, adult: Boolean = true) {
        compose.setSgmUiTestContent { TeamPushOpenRoute(request, "parent", adult, gateway, conversations()) {} }
    }
    private fun privateContentAbsent() {
        compose.onNodeWithText("Message après admission QA").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(15_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun conversations() = object : TeamConversationGateway {
        override suspend fun choices(uid: String, clubId: String?, cursor: String?) = error("Direct alert does not use the directory")
        override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?): TeamConversationPage {
            check(uid == "parent" && target == this@TeamPushOpenFlowTest.target)
            return TeamConversationPage("Équipe QA", "c".repeat(64),
                listOf(ConversationMessage("peer", "Message après admission QA", false, 100)), null)
        }
        override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String) = error("No message send in this trial")
        override suspend fun markRead(uid: String, target: TeamConversationTarget, accessVersion: String, messageIds: List<String>) = error("No unread message fixture")
    }
}
