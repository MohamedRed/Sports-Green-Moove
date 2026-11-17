package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
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
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.TeamConversationDraftRecord
import be.sportgreenmoove.app.services.TeamConversationDraftStorage
import kotlinx.coroutines.launch
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.io.IOException

class TeamConversationDraftFlowTest {
    @get:Rule val compose = createComposeRule()
    private val storage = Storage()
    private val state = TeamConversationDraftState("parent", TeamConversationTarget("team", "a".repeat(64)), storage)
    private var sends = 0

    @Test fun anUnreadableDraftHasExplicitRetryAndNoBlankComposerOnANarrowLargeTextScreen() {
        storage.saved = TeamConversationDraftRecord("Message conservé QA", null); storage.failRead = true; state.load(); host()
        compose.onNodeWithTag("team-chat.draft-retry").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
        compose.onNodeWithText("private-storage-detail", substring = true).assertDoesNotExist()
        capture("team-draft-read-error")
        compose.runOnIdle { storage.failRead = false }
        compose.onNodeWithTag("team-chat.draft-retry").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertTextContains("Message conservé QA")
        compose.runOnIdle { assertEquals(0, sends) }
    }
    @Test fun failedStorageKeepsTypedTextVisibleAndBlocksSendUntilAnExplicitRetry() {
        state.load(); storage.failWrite = true; host()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("À conserver QA")
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.onNodeWithText("Impossible de conserver le brouillon. Réessayez.").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertTextContains("À conserver QA")
        compose.runOnIdle { assertEquals(0, sends) }; capture("team-draft-write-error")
        compose.runOnIdle { storage.failWrite = false }
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).performClick()
        compose.waitUntil(10_000) { state.composer?.draft == "" }
        compose.runOnIdle { assertEquals(1, sends); assertNull(storage.saved) }
    }
    private fun host() = compose.setSgmUiTestContent {
        val density = LocalDensity.current; val scope = rememberCoroutineScope()
        CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
            Box(Modifier.width(320.dp).fillMaxHeight()) {
                val composer = state.composer
                if (composer == null) TeamConversationDraftScreen(state.error, state::load, {})
                else ConversationComposer(composer.draft, composer::edit, composer.locked, composer.sending,
                    enabled = true, error = composer.error, onSend = { scope.launch {
                        composer.sendOperation({ _, _ -> sends++; "message" }) { false }
                    } })
            }
        }
    }
    private fun capture(stem: String) {
        captureLocalUi(compose, "$stem.png")
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val device = UiDevice.getInstance(instrumentation)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        check(device.takeScreenshot(File(directory, "$stem-window.png")))
        check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-team-chat-components").isBlank())
        for (suffix in listOf(".png", "-window.png")) check(device.executeShellCommand(
            "cp ${File(directory, stem + suffix).absolutePath} /sdcard/Download/sgm-team-chat-components/$stem$suffix").isBlank())
    }
    private class Storage : TeamConversationDraftStorage {
        var saved: TeamConversationDraftRecord? = null; var failRead = false; var failWrite = false
        override fun read(uid: String, target: TeamConversationTarget): TeamConversationDraftRecord? {
            if (failRead) throw IOException("private-storage-detail"); return saved
        }
        override fun write(uid: String, target: TeamConversationTarget, record: TeamConversationDraftRecord?) {
            if (failWrite) throw IOException("private-storage-detail"); saved = record
        }
    }
}
