package be.sportgreenmoove.app.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationDraftRecord
import be.sportgreenmoove.app.services.SharedPreferencesConversationDrafts
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.util.UUID

class ConversationDraftFlowTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val ref = ConversationRef(ConversationKind.Booking, "booking-1")

    @Test fun accountSwitchAndComposableRecreationRestoreOnlyTheOwnersUnsentDraft() {
        val firstUid = "draft-flow-${UUID.randomUUID()}"
        val secondUid = "other-$firstUid"
        val account = mutableStateOf(firstUid)
        val generation = mutableStateOf(0)
        val gateway = UiFlowConversationGateway()
        val storage = SharedPreferencesConversationDrafts(compose.activity)
        try {
            compose.setSgmUiTestContent {
                key(account.value, generation.value) { ConversationRoute(account.value, ref, gateway, onBack = {}) }
            }
            waitForInput(); compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Private draft")
            compose.runOnIdle { generation.value++ }; waitForInput(); assertDraft("Private draft")
            compose.runOnIdle { account.value = secondUid }; waitForInput(); assertDraft("")
            compose.runOnIdle { account.value = firstUid }; waitForInput(); assertDraft("Private draft")
            assertTrue(gateway.requests.isEmpty())
        } finally { storage.write(firstUid, ref, null); storage.write(secondUid, ref, null) }
    }
    @Test fun corruptStorageShowsRetryWithoutAnEmptyComposerThenRestoresThePreservedDraft() {
        val uid = "draft-flow-${UUID.randomUUID()}"
        val preferences = compose.activity.getSharedPreferences("private-conversation-drafts", 0)
        val name = JSONArray(listOf(uid, ref.kind.sourceType, ref.sourceId)).toString()
        val storage = SharedPreferencesConversationDrafts(compose.activity)
        val gateway = UiFlowConversationGateway()
        check(preferences.edit().putString(name, "not-json").commit())
        try {
            compose.setSgmUiTestContent { ConversationRoute(uid, ref, gateway, onBack = {}) }
            compose.waitUntil(5_000) { compose.onAllNodesWithTag("chat.draft-retry").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
            compose.onNodeWithTag("chat.draft-retry").assertIsDisplayed().assertIsEnabled()
            assertEquals("not-json", preferences.getString(name, null))
            storage.write(uid, ref, ConversationDraftRecord("Preserved", null))
            compose.onNodeWithTag("chat.draft-retry").performClick()
            waitForInput(); assertDraft("Preserved"); assertTrue(gateway.requests.isEmpty())
        } finally { storage.write(uid, ref, null) }
    }
    private fun waitForInput() = compose.waitUntil(5_000) {
        compose.onAllNodesWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNodes().isNotEmpty()
    }
    private fun assertDraft(text: String) = assertEquals(text,
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().config[SemanticsProperties.EditableText].text)
}
