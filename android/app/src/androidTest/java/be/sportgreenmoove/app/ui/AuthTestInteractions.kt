package be.sportgreenmoove.app.ui

import android.view.Window
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.MainActivity
import org.json.JSONObject
import java.io.Closeable
import java.io.File

internal class AuthTestInteractions(
    private val compose: ComposeTestRule,
    private val activity: ActivityScenario<MainActivity>,
) : Closeable {
    private lateinit var window: Window
    private val animations = mutableSetOf<WindowInsetsAnimationCompat>()
    private var phase = "window-ready"
    private val callback = object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        override fun onPrepare(animation: WindowInsetsAnimationCompat) {
            if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) animations.add(animation)
        }
        override fun onEnd(animation: WindowInsetsAnimationCompat) { animations.remove(animation) }
        override fun onProgress(insets: WindowInsetsCompat, runningAnimations: MutableList<WindowInsetsAnimationCompat>) = insets
    }
    init {
        activity.onActivity { window = it.window; ViewCompat.setWindowInsetsAnimationCallback(window.decorView, callback) }
    }

    fun signIn(email: String, password: String) {
        try {
            compose.waitUntil(15_000) { var ready = false; activity.onActivity { ready = window.decorView.hasWindowFocus() }; ready }
            phase = "email-keyboard-ready"
            val emailInput = compose.onNodeWithTag(SgmTestTags.AuthEmailInput)
            emailInput.performScrollTo().performClick().assertIsFocused()
            awaitKeyboard(true)
            emailInput.performTextReplacement(email)
            phase = "password-focused"
            compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performClick().assertIsFocused().performTextReplacement(password)
            check(inputMatches(SgmTestTags.AuthEmailInput, email) && inputLengthMatches(SgmTestTags.AuthPasswordInput, password.length)) {
                "Login fields must contain the requested local credentials."
            }
            phase = "keyboard-dismissed"
            activity.onActivity { WindowCompat.getInsetsController(window, window.decorView).hide(WindowInsetsCompat.Type.ime()) }
            awaitKeyboard(false)
            phase = "submit-touch"
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().assertIsDisplayed().assertIsEnabled().performClick()
            phase = "awaiting-home"
            compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.HomeScreen).fetchSemanticsNodes().isNotEmpty() }
        } catch (failure: Throwable) {
            runCatching { diagnostic(email, password) }
            throw failure
        }
    }

    private fun awaitKeyboard(visible: Boolean) {
        compose.waitUntil(15_000) {
            var ready = false
            activity.onActivity {
                val insets = ViewCompat.getRootWindowInsets(window.decorView)
                ready = insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()) == visible && animations.isEmpty()
            }
            ready
        }
        compose.waitForIdle()
    }

    private fun inputMatches(tag: String, value: String) = compose.onNodeWithTag(tag).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text == value

    private fun inputLengthMatches(tag: String, length: Int) = compose.onNodeWithTag(tag).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text.length == length

    private fun diagnostic(email: String, password: String) {
        val data = JSONObject().put("phase", phase)
            .put("emailMatches", runCatching { inputMatches(SgmTestTags.AuthEmailInput, email) }.getOrDefault(false))
            .put("passwordLengthMatches", runCatching { inputLengthMatches(SgmTestTags.AuthPasswordInput, password.length) }.getOrDefault(false))
        activity.onActivity {
            data.put("windowFocused", window.decorView.hasWindowFocus())
                .put("keyboardVisible", ViewCompat.getRootWindowInsets(window.decorView)?.isVisible(WindowInsetsCompat.Type.ime()))
                .put("keyboardAnimations", animations.size)
        }
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "local-ui-evidence")
        check(directory.isDirectory || directory.mkdirs())
        File(directory, "local-landscape-login-readiness.json").writeText(data.toString(2))
    }

    override fun close() { activity.onActivity { ViewCompat.setWindowInsetsAnimationCallback(window.decorView, null) } }
}
