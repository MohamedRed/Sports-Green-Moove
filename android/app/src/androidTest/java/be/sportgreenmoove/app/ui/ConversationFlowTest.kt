package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.MessageSendException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import java.io.IOException

class ConversationFlowTest {
    @get:Rule val compose = createComposeRule()
    private val ref = ConversationRef(ConversationKind.Booking, "booking-1")

    @Test fun aConversationOpensSendsAndKeepsItsDraftWhenReturningToTheInbox() {
        val gateway = UiFlowConversationGateway()
        val firebase = UiFlowFirebaseGateway()
        compose.setSgmUiTestContent { MessagesScreen(firebase, gateway) }
        waitFor(SgmTestTags.ChatOpenAction)
        compose.onNodeWithTag(SgmTestTags.ChatOpenAction).performClick()
        waitFor(SgmTestTags.ChatMessageInput)
        waitForText("Départ confirmé.")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("   ")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsNotEnabled()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextReplacement("À confirmer.")
        compose.onNodeWithTag(SgmTestTags.BackAction).performClick()
        waitFor(SgmTestTags.ChatOpenAction)
        compose.onNodeWithTag(SgmTestTags.ChatOpenAction).performClick()
        waitFor(SgmTestTags.ChatMessageInput)
        assertDraft("À confirmer.")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.waitUntil(5_000) { gateway.requests.size == 1 && gateway.current.value.messages.size == 2 }
        compose.onNodeWithText("À confirmer.").assertExists()
        assertDraft("")
        assertEquals(setOf("received-1"), gateway.readIds)
    }

    @Test fun uncertainSendsKeepTheirIdentityAndTextUntilTheRetryIsConfirmed() {
        val gateway = UiFlowConversationGateway().apply { sendFailure = MessageSendException(false, IOException()) }
        show(gateway)
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Nous arrivons.")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        waitForText("Envoi non confirmé. Réessayez.")
        assertDraft("Nous arrivons.")
        compose.runOnIdle { gateway.sendFailure = null }
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.waitUntil(5_000) { gateway.requests.size == 2 && gateway.current.value.messages.size == 2 }
        assertEquals(gateway.requests[0].requestId, gateway.requests[1].requestId)
        assertEquals(gateway.requests[0].body, gateway.requests[1].body)
        assertDraft("")
    }

    @Test fun aDefinitiveRejectionLetsTheUserEditAndSubmitANewIntent() {
        val gateway = UiFlowConversationGateway().apply { sendFailure = MessageSendException(true, IllegalArgumentException()) }
        show(gateway)
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Premier message")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        waitForText("Envoi refusé. Vérifiez le message et réessayez.")
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextReplacement("Message corrigé")
        compose.runOnIdle { gateway.sendFailure = null }
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.waitUntil(5_000) { gateway.requests.size == 2 && gateway.current.value.messages.size == 2 }
        assertNotEquals(gateway.requests[0].requestId, gateway.requests[1].requestId)
        assertEquals("Message corrigé", gateway.requests[1].body)
    }

    @Test fun oversizedDraftsAndInaccessibleThreadsCannotSend() {
        val gateway = UiFlowConversationGateway()
        show(gateway)
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("x".repeat(1001))
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsNotEnabled()
        compose.onNodeWithText("Maximum 1 000 caractères.").assertExists()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextReplacement("Un message valide")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled()
    }

    @Test fun anUnavailableThreadShowsRetryInsteadOfAFabricatedEmptyConversation() {
        val gateway = UiFlowConversationGateway().apply { observeFailure = IllegalStateException("Access denied") }
        compose.setSgmUiTestContent { ConversationRoute(ref, gateway, onBack = {}) }
        waitFor(SgmTestTags.ChatRetryAction)
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
        compose.onNodeWithText("Aucun message.").assertDoesNotExist()
    }

    private fun show(gateway: UiFlowConversationGateway) {
        compose.setSgmUiTestContent { ConversationRoute(ref, gateway, onBack = {}) }
        waitFor(SgmTestTags.ChatMessageInput)
        waitForText("Départ confirmé.")
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled()
    }

    private fun waitFor(tag: String) = compose.waitUntil(5_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun waitForText(text: String) = compose.waitUntil(5_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    private fun assertDraft(value: String) = assertEquals(value,
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().config[SemanticsProperties.EditableText].text)
}
