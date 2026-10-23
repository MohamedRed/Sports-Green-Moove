package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import be.sportgreenmoove.app.data.ConversationDirectoryPage
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ConversationDirectoryFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test fun startsAnEmptyConversationFromItsReservationWithoutAnInventedFirstMessage() {
        val gateway = UiFlowConversationGateway().apply { directory = ConversationDirectoryPage(emptyList(), null, null, null) }
        compose.setSgmUiTestContent { MessagesScreen(UiFlowFirebaseGateway(), gateway, "parent") }
        waitForText("Aucune conversation.")
        compose.onNodeWithTag(SgmTestTags.ChatNewConversationAction).performClick()
        waitFor("${SgmTestTags.ChatBookingOptionAction}.new-booking-1")
        compose.onNodeWithText("Trajet de Lina").assertIsDisplayed()
        compose.onNodeWithText("Acceptée").assertIsDisplayed()
        compose.onNodeWithTag("${SgmTestTags.ChatBookingOptionAction}.new-booking-1").performClick()
        waitForText("Aucun message.")
        compose.onNodeWithText("Trajet de Lina").assertIsDisplayed()
        assertEquals(0, gateway.requests.size)
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled().performTextInput("Premier rendez-vous.")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.waitUntil(5_000) {
            gateway.requests.size == 1 && gateway.threads.getValue("booking:new-booking-1").value.messages.size == 1 &&
                compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
                    .config[SemanticsProperties.EditableText].text.isEmpty()
        }
        waitForText("Premier rendez-vous.")
        assertEquals("new-booking-1", gateway.requests.single().ref.sourceId)
        compose.onNodeWithTag(SgmTestTags.BackAction).performClick()
        waitForText("Premier rendez-vous.")
        compose.onNodeWithTag(SgmTestTags.ChatOpenAction).assertIsDisplayed()
    }

    @Test fun inaccessibleDirectoryDoesNotPretendThereAreNoConversations() {
        val gateway = UiFlowConversationGateway().apply { directoryFailure = IllegalStateException("Unavailable") }
        compose.setSgmUiTestContent { MessagesScreen(UiFlowFirebaseGateway(), gateway, "parent") }
        waitFor(SgmTestTags.ChatInboxRetryAction)
        compose.onNodeWithText("Aucune conversation.").assertDoesNotExist()
        compose.runOnIdle { gateway.directoryFailure = null }
        compose.onNodeWithTag(SgmTestTags.ChatInboxRetryAction).performClick()
        waitFor(SgmTestTags.ChatOpenAction)
    }

    private fun waitFor(tag: String) = compose.waitUntil(5_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun waitForText(text: String) = compose.waitUntil(5_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
}
