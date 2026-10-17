package be.sportgreenmoove.app.ui

import android.content.Context
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.core.app.ActivityScenario
import be.sportgreenmoove.app.MainActivity
import org.json.JSONObject
import java.io.File
import kotlin.math.abs

internal class LocalChatSendInteraction(
    private val compose: ComposeTestRule,
    private val activity: ActivityScenario<MainActivity>,
    private val directory: File,
) {
    fun send(body: String, evidenceName: String, onPhase: (String) -> Unit) {
        var phase = "window-ready"
        try {
            onPhase(phase)
            compose.waitUntil(30_000) { windowFocused() }
            closeKeyboard()
            val input = compose.onNodeWithTag(SgmTestTags.ChatMessageInput)
            input.assertIsEnabled().assertIsDisplayed()
            val restingTop = input.fetchSemanticsNode().boundsInRoot.top
            phase = "keyboard-open"; onPhase(phase)
            input.performClick().assertIsFocused()
            compose.waitUntil(30_000) { keyboardVisible() }
            input.performTextReplacement(body)
            phase = "keyboard-close"; onPhase(phase)
            closeKeyboard()
            compose.waitUntil(30_000) {
                abs(input.fetchSemanticsNode().boundsInRoot.top - restingTop) < 2f
            }
            phase = "send-acknowledged"; onPhase(phase)
            compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsDisplayed().assertIsEnabled().performClick()
            compose.waitUntil(60_000) { draft().isEmpty() }
            compose.waitUntil(60_000) { compose.onAllNodesWithText(body).fetchSemanticsNodes().isNotEmpty() }
            compose.waitUntil(60_000) { compose.onAllNodesWithText("Envoi en cours...").fetchSemanticsNodes().isEmpty() }
            onPhase("confirmed")
        } catch (failure: Throwable) {
            // Capture before ActivityScenario.use closes the failed screen.
            runCatching { captureLocalUi(compose, "$evidenceName-failed.png") }
                .onFailure(failure::addSuppressed)
            runCatching { writeDiagnostic(evidenceName, phase) }.onFailure(failure::addSuppressed)
            throw failure
        }
    }
    private fun writeDiagnostic(name: String, phase: String) {
        val state = JSONObject().put("phase", phase).put("windowFocused", windowFocused())
            .put("keyboardVisible", keyboardVisible())
        activity.onActivity { state.put("windowWidth", it.window.decorView.width).put("windowHeight", it.window.decorView.height) }
        for ((name, tag) in mapOf("chatVisible" to SgmTestTags.ChatThreadScreen, "homeVisible" to SgmTestTags.HomeScreen,
            "inboxVisible" to SgmTestTags.MessagesScreen)) {
            state.put(name, compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty())
        }
        state.put("draftLength", runCatching { draft().length }.getOrNull() ?: JSONObject.NULL)
        File(directory, "$name-state.json").writeText(state.toString(2))
    }
    private fun draft() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun closeKeyboard() {
        if (keyboardVisible()) {
            activity.onActivity { it.getSystemService(InputMethodManager::class.java)
                .hideSoftInputFromWindow(it.window.decorView.windowToken, 0) }
            compose.waitUntil(30_000) { !keyboardVisible() }
        }
        compose.waitForIdle()
    }
    private fun windowFocused(): Boolean {
        var focused = false
        activity.onActivity { focused = it.window.decorView.hasWindowFocus() }
        return focused
    }
    private fun keyboardVisible(): Boolean {
        var visible = false
        activity.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        return visible
    }
}
