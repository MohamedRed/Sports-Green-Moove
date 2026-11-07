package be.sportgreenmoove.app.ui

import android.app.KeyguardManager
import android.os.PowerManager
import android.util.Log
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

internal class InputWindowReadiness(
    private val compose: ComposeTestRule,
    input: SemanticsNodeInteraction,
) {
    // A dialog has its own window; the host activity cannot prove its input readiness.
    private val root = checkNotNull(input.fetchSemanticsNode().root as? ViewRootForTest) {
        "The input must belong to an Android composition."
    }
    private val view get() = root.view

    fun awaitFocus(timeoutMillis: Long) {
        logState("before-window-focus")
        try {
            compose.waitUntil(timeoutMillis) {
                compose.runOnUiThread {
                    view.isAttachedToWindow && view.windowToken != null &&
                        root.isLifecycleInResumedState && view.hasWindowFocus()
                }
            }
            logState("window-focused")
        } catch (failure: Throwable) {
            logState("window-focus-failed")
            InputWindowDiagnostics.captureFailure()
            throw failure
        }
    }

    fun keyboardVisible(): Boolean = compose.runOnUiThread {
        ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime()) == true
    }

    fun logState(phase: String, inspectEditor: Boolean = false) = compose.runOnUiThread {
        val manager = view.context.getSystemService(InputMethodManager::class.java)
        val power = view.context.getSystemService(PowerManager::class.java)
        val keyguard = view.context.getSystemService(KeyguardManager::class.java)
        val active = if (inspectEditor) manager.isActive(view) else null
        val accepting = if (inspectEditor) manager.isAcceptingText else null
        val window = view.rootView.layoutParams as? WindowManager.LayoutParams
        Log.i("SgmInputReadiness", "phase=$phase attached=${view.isAttachedToWindow} " +
            "windowTokenPresent=${view.windowToken != null} resumed=${root.isLifecycleInResumedState} " +
            "windowFocused=${view.hasWindowFocus()} viewFocused=${view.hasFocus()} " +
            "interactive=${power.isInteractive} keyguardLocked=${keyguard.isKeyguardLocked} " +
            "deviceLocked=${keyguard.isDeviceLocked} rootShown=${view.rootView.isShown} " +
            "decorWindowFocused=${view.rootView.hasWindowFocus()} windowType=${window?.type} " +
            "windowNotFocusable=${window?.let { it.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE != 0 }} " +
            "windowVisibility=${view.windowVisibility} displayState=${view.display?.state} " +
            "servedView=$active acceptingText=$accepting " +
            "keyboardVisible=${ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime())}")
    }
}
