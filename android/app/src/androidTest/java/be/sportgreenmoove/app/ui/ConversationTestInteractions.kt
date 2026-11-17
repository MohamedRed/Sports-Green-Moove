package be.sportgreenmoove.app.ui

import android.graphics.Rect
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.ext.junit.rules.ActivityScenarioRule
import org.junit.Assert.assertTrue
import java.io.Closeable

internal class ConversationTestInteractions(
    private val compose: AndroidComposeTestRule<ActivityScenarioRule<ComponentActivity>, ComponentActivity>,
) : Closeable {
    private val imeAnimations = mutableSetOf<WindowInsetsAnimationCompat>()
    private val callback = object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        override fun onPrepare(animation: WindowInsetsAnimationCompat) {
            if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) imeAnimations.add(animation)
        }
        override fun onEnd(animation: WindowInsetsAnimationCompat) { imeAnimations.remove(animation) }
        override fun onProgress(insets: WindowInsetsCompat, runningAnimations: MutableList<WindowInsetsAnimationCompat>) = insets
    }

    init { compose.runOnUiThread { ViewCompat.setWindowInsetsAnimationCallback(compose.activity.window.decorView, callback) } }

    fun enterDraft(value: String, replace: Boolean = false) {
        val input = compose.onNodeWithTag(SgmTestTags.ChatMessageInput)
        val window = InputWindowReadiness(compose, input)
        window.awaitFocus(5_000)
        input.assertIsEnabled().performClick().assertIsFocused()
        try { awaitKeyboard(true) }
        catch (failure: Throwable) { window.logState("conversation-keyboard-failed", inspectEditor = true); throw failure }
        window.logState("conversation-keyboard-visible", inspectEditor = true)
        if (replace) input.performTextReplacement(value) else input.performTextInput(value)
    }

    fun send(gateway: UiFlowConversationGateway, expectedRequests: Int, keyboardVisible: Boolean) {
        if (!keyboardVisible) compose.runOnUiThread {
            val window = compose.activity.window
            WindowCompat.getInsetsController(window, window.decorView).hide(WindowInsetsCompat.Type.ime())
        }
        awaitKeyboard(keyboardVisible)
        val button = compose.onNodeWithTag(SgmTestTags.ChatSendAction)
        button.assertIsEnabled().assertIsDisplayed()
        val bounds = button.fetchSemanticsNode().boundsInWindow
        val visible = Rect()
        val origin = IntArray(2)
        val local = IntArray(2)
        compose.runOnUiThread {
            compose.activity.window.decorView.apply {
                getWindowVisibleDisplayFrame(visible)
                getLocationOnScreen(origin)
                getLocationInWindow(local)
            }
        }
        assertTrue("Send control must remain above the real keyboard", bounds.bottom + origin[1] - local[1] <= visible.bottom + 2)
        Log.i("SgmConversationTest", "send expectedRequests=$expectedRequests keyboard=$keyboardVisible bounds=$bounds visible=$visible")
        button.performClick()
        try { compose.waitUntil(5_000) { compose.runOnIdle { gateway.requests.size == expectedRequests } } }
        catch (failure: Throwable) {
            Log.e("SgmConversationTest", "send not received; requests=${compose.runOnIdle { gateway.requests.size }}")
            throw failure
        }
    }

    private fun awaitKeyboard(visible: Boolean) {
        compose.waitUntil(5_000) {
            compose.runOnUiThread {
                val insets = ViewCompat.getRootWindowInsets(compose.activity.window.decorView)
                insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()) == visible && imeAnimations.isEmpty()
            }
        }
        compose.waitForIdle()
    }

    override fun close() {
        compose.runOnUiThread { ViewCompat.setWindowInsetsAnimationCallback(compose.activity.window.decorView, null) }
    }
}
