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
import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class TeamConversationFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun messageEntryAndEmptyScannedPagesReachTheApprovedTeamOnANarrowLargeTextScreen() {
        val fixture = TeamChatUiFixture(); host(fixture, narrow = true)
        click("team-chat.tab"); click("team-chat.choice.club")
        waitFor(hasTestTag("team-chat.choices-more"))
        compose.onNodeWithText("Aucune équipe approuvée.").assertDoesNotExist()
        click("team-chat.choices-more"); click("team-chat.choice.team")
        waitFor(hasText(fixture.title)); compose.onNodeWithText("Message conducteur QA").assertIsDisplayed()
        val layout = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(fixture.title).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layout) }
        assertFalse(layout.single().hasVisualOverflow); assertEquals(0, fixture.sent.size)
        capture("team-chat-narrow")
    }
    @Test fun aFailedFreshAuthorizationKeepsTheErrorAndRemovesTheThreadAndComposer() {
        val fixture = TeamChatUiFixture(); host(fixture); open()
        fixture.deny = true; click("team-chat.refresh")
        waitFor(hasTestTag("team-chat.retry"))
        compose.onNodeWithText(fixture.title).assertDoesNotExist()
        compose.onNodeWithText("Message conducteur QA").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
        compose.runOnIdle { assertEquals(0, fixture.sent.size) }
        capture("team-chat-denied")
    }
    @Test fun anUnconfirmedSendRetriesTheSameIntentAndOnlyOneMessageIsAdded() {
        val fixture = TeamChatUiFixture().apply { loseFirstSend = true }; host(fixture); open()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Réponse parent QA")
        click(SgmTestTags.ChatSendAction); waitFor(hasText("Envoi non confirmé. Réessayez."))
        capture("team-chat-unconfirmed")
        click(SgmTestTags.ChatSendAction)
        waitFor(hasText("Réponse parent QA"))
        compose.waitUntil(30_000) { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
            .config[androidx.compose.ui.semantics.SemanticsProperties.EditableText].text.isEmpty() }
        compose.runOnIdle {
            assertEquals(2, fixture.attempts.size); assertEquals(1, fixture.attempts.distinct().size)
            assertEquals(1, fixture.sent.size)
        }
        capture("team-chat-confirmed")
    }
    private fun host(fixture: TeamChatUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            val content: @androidx.compose.runtime.Composable () -> Unit = {
                MessagesScreen(UiFlowFirebaseGateway(), UiFlowConversationGateway(), fixture, "parent")
            }
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp)) { content() }
                }
            } else content()
        }
        waitFor(hasTestTag("team-chat.tab"))
    }
    private fun open() {
        click("team-chat.tab"); click("team-chat.choice.club"); click("team-chat.choices-more"); click("team-chat.choice.team")
        waitFor(hasText("Message conducteur QA"))
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); compose.onNodeWithTag(tag).assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(30_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun capture(stem: String) = captureTeamChatComponent(compose, stem,
        "local-team-chat-component-with-fake-gateway-not-connected-or-physical", landscape = false)
}

private class TeamChatUiFixture : TeamConversationGateway {
    val title = "Équipe U8 Nationaux du club de la Croix Saint-Lambert QA"
    var deny = false; var loseFirstSend = false
    val attempts = mutableListOf<String>(); val sent = linkedMapOf<String, ConversationMessage>()
    override suspend fun choices(uid: String, clubId: String?, cursor: String?): GuardianPage<TeamChatChoice> {
        check(uid == "parent" && !deny)
        return when {
            clubId == null -> GuardianPage(listOf(TeamChatChoice("club", "Club QA", null, null)), null)
            cursor == null -> GuardianPage(emptyList(), "next")
            else -> GuardianPage(listOf(TeamChatChoice("team", title, "a".repeat(64), 0)), null)
        }
    }
    override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?): TeamConversationPage {
        check(uid == "parent" && !deny)
        return TeamConversationPage(title, "b".repeat(64), sent.values.toList().reversed() +
            ConversationMessage("peer", "Message conducteur QA", false, 100, authorName = "Conducteur QA"), null)
    }
    override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String {
        check(uid == "parent" && !deny); attempts += requestId
        if (loseFirstSend && attempts.size == 1) throw MessageSendException(false, IllegalStateException("Explicit uncertain-send fixture"))
        sent.putIfAbsent(requestId, ConversationMessage(requestId, body, true, 200, requestId = requestId))
        return requestId
    }
    override suspend fun markRead(uid: String, target: TeamConversationTarget, accessVersion: String, messageIds: List<String>) {
        error("This simulated fixture does not contain unread messages")
    }
}
