package be.sportgreenmoove.app.ui

import android.graphics.Rect
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import java.io.File

internal fun sendNativeTeamMessage(compose: ComposeTestRule, body: String) {
    val input = compose.onNodeWithTag(SgmTestTags.ChatMessageInput)
    val window = InputWindowReadiness(compose, input)
    val root = checkNotNull(input.fetchSemanticsNode().root as? ViewRootForTest).view.rootView
    val animations = mutableSetOf<WindowInsetsAnimationCompat>()
    val callback = object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        override fun onPrepare(animation: WindowInsetsAnimationCompat) {
            if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) animations.add(animation)
        }
        override fun onEnd(animation: WindowInsetsAnimationCompat) { animations.remove(animation) }
        override fun onProgress(insets: WindowInsetsCompat, runningAnimations: MutableList<WindowInsetsAnimationCompat>) = insets
    }
    fun text() = input.fetchSemanticsNode().config[SemanticsProperties.EditableText].text
    compose.runOnUiThread { ViewCompat.setWindowInsetsAnimationCallback(root, callback) }
    try {
        window.awaitFocus(15_000); check(text().isEmpty())
        input.assertIsEnabled().performClick().assertIsFocused()
        compose.waitUntil(15_000) { compose.runOnUiThread {
            ViewCompat.getRootWindowInsets(root)?.isVisible(WindowInsetsCompat.Type.ime()) == true && animations.isEmpty()
        } }
        compose.waitForIdle(); input.performTextInput(body); input.assertTextEquals(body)
        val button = compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().assertIsDisplayed()
        val bounds = button.fetchSemanticsNode().boundsInWindow
        val visible = Rect(); val origin = IntArray(2); val local = IntArray(2)
        compose.runOnUiThread { root.getWindowVisibleDisplayFrame(visible); root.getLocationOnScreen(origin); root.getLocationInWindow(local) }
        check(bounds.bottom + origin[1] - local[1] <= visible.bottom + 2) { "The send control must remain above the keyboard" }
        button.performClick()
        compose.waitUntil(60_000) { text().isEmpty() }
        compose.waitUntil(60_000) { compose.onAllNodesWithText(body).fetchSemanticsNodes().isNotEmpty() }
    } catch (failure: Throwable) {
        try {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            check(context.packageName == "be.sportgreenmoove.app.local")
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
            val state = JSONObject().put("scope", "failed-native-team-send-observation-not-delivery-proof")
                .put("keyboardVisible", window.keyboardVisible()).put("draftMatchesExpected", text() == body)
            for ((key, label) in listOf("sending" to "Envoi en cours...", "refused" to "Envoi refusé. Vérifiez le message et réessayez.",
                "uncertain" to "Envoi non confirmé. Réessayez.")) state.put(key, compose.onAllNodesWithText(label).fetchSemanticsNodes().isNotEmpty())
            File(directory, "team-send-failure.json").writeText(state.toString(2))
            check(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(File(directory, "team-send-failure-window.png")))
        } catch (_: Throwable) { /* Preserve the original assertion if diagnostics also fail. */ }
        throw failure
    } finally { compose.runOnUiThread { ViewCompat.setWindowInsetsAnimationCallback(root, null) } }
}
