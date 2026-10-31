package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class TeamConversationReadFlowTest {
    @get:Rule val compose = createComposeRule()
    private val scope = "local-team-chat-read-component-with-fake-gateway-not-connected-or-physical"
    @Test fun narrowLargeTextCountAndVisibleOnlyReadsDoNotMarkTheWholeThread() {
        val fixture = TeamConversationReadUiFixture(); host(fixture, narrow = true); directory()
        compose.onNodeWithTag("team-chat.unread.team").assertTextEquals("99+ non lus")
        captureTeamChatComponent(compose, "team-read-count-narrow", scope, landscape = false)
        click("team-chat.choice.team"); waitFor(hasText("Message équipe QA 0"))
        compose.waitUntil(30_000) { fixture.readIds.isNotEmpty() }
        compose.runOnIdle { assertTrue(fixture.readIds.size < fixture.count); assertTrue(fixture.readIds.all { it.startsWith("peer-") }) }
        captureTeamChatComponent(compose, "team-read-visible", scope, landscape = false)
    }
    @Test fun landscapeReadFailureStaysUnreadUntilRetryAndDirectoryKeepsTheRemainder() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()); device.setOrientationLeft()
        try {
            val fixture = TeamConversationReadUiFixture(8).apply { failRead = true }; host(fixture); directory(); click("team-chat.choice.team")
            waitFor(hasTestTag("team-chat.read-retry")); compose.runOnIdle { assertTrue(fixture.readIds.isEmpty()) }
            captureTeamChatComponent(compose, "team-read-error", scope, landscape = true)
            fixture.failRead = false; click("team-chat.read-retry")
            compose.waitUntil(30_000) { fixture.readIds.isNotEmpty() }
            compose.onNodeWithTag("team-chat.read-retry").assertDoesNotExist()
            device.pressBack(); waitFor(hasTestTag("team-chat.choice.team"))
            val remaining = fixture.count - fixture.readIds.size
            if (remaining == 0) compose.onNodeWithTag("team-chat.unread.team").assertDoesNotExist()
            else compose.onNodeWithTag("team-chat.unread.team").assertTextEquals(if (remaining == 1) "1 non lu" else "$remaining non lus")
            captureTeamChatComponent(compose, "team-read-retry", scope, landscape = true)
        } finally { device.setOrientationNatural() }
    }
    @Test fun aReadAuthorityRejectionRemovesPrivateContentAndTheComposer() {
        val fixture = TeamConversationReadUiFixture(8).apply { rejectRead = true }; host(fixture); directory(); click("team-chat.choice.team")
        waitFor(hasTestTag("team-chat.retry"))
        compose.onNodeWithText(fixture.title).assertDoesNotExist()
        compose.onNodeWithText("Message équipe QA 0").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
        compose.runOnIdle { assertTrue(fixture.readIds.isEmpty()); assertEquals(1, fixture.readAttempts) }
        captureTeamChatComponent(compose, "team-read-revoked", scope, landscape = false)
    }
    private fun host(fixture: TeamConversationReadUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            val content: @androidx.compose.runtime.Composable () -> Unit = { MessagesScreen(UiFlowFirebaseGateway(), UiFlowConversationGateway(), fixture, "parent") }
            if (narrow) CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) { Box(Modifier.width(320.dp)) { content() } }
            else content()
        }
        waitFor(hasTestTag("team-chat.tab"))
    }
    private fun directory() { click("team-chat.tab"); click("team-chat.choice.club"); waitFor(hasTestTag("team-chat.choice.team")) }
    private fun click(tag: String) { waitFor(hasTestTag(tag) and isEnabled()); compose.onNodeWithTag(tag).performClick() }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(30_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
}
