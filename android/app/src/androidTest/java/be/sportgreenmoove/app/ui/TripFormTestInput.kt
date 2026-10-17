package be.sportgreenmoove.app.ui

import android.view.inspector.WindowInspector
import androidx.annotation.RequiresApi
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice

@RequiresApi(29)
internal fun enterCancellationReason(compose: ComposeTestRule, reason: String) {
    enterTripFormText(compose, "trip.cancel.reason", reason, "trip.cancel.confirm")
}

@RequiresApi(29)
internal fun enterTripFormText(compose: ComposeTestRule, inputTag: String, value: String, actionTag: String) {
    fun keyboardVisible() = compose.runOnIdle {
        WindowInspector.getGlobalWindowViews().any {
            ViewCompat.getRootWindowInsets(it)?.isVisible(WindowInsetsCompat.Type.ime()) == true
        }
    }
    val input = compose.onNodeWithTag(inputTag)
    input.performScrollTo().performClick().assertIsFocused()
    compose.waitUntil(15_000) { keyboardVisible() }
    input.performTextReplacement(value)
    check(input.fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.EditableText].text == value) {
        "The trip form must contain the requested text."
    }
    UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
    compose.waitUntil(15_000) { !keyboardVisible() }
    compose.waitForIdle()
    compose.onNodeWithTag(actionTag).performScrollTo().assertIsDisplayed().assertIsEnabled()
}
