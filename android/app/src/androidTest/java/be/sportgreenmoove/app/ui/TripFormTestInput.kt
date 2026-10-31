package be.sportgreenmoove.app.ui

import androidx.annotation.RequiresApi
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice

@RequiresApi(29)
internal fun enterCancellationReason(compose: ComposeTestRule, reason: String) {
    enterTripFormText(compose, "trip.cancel.reason", reason)
    compose.onNodeWithTag("trip.cancel.confirm").assertIsDisplayed().assertIsEnabled()
}

@RequiresApi(29)
internal fun enterTripFormText(compose: ComposeTestRule, inputTag: String, value: String) {
    val input = compose.onNodeWithTag(inputTag)
    input.performScrollTo()
    val window = InputWindowReadiness(compose, input)
    window.awaitFocus(15_000)
    input.performClick().assertIsFocused()
    try { compose.waitUntil(15_000) { window.keyboardVisible() } }
    catch (failure: Throwable) { window.logState("trip-form-keyboard-failed", inspectEditor = true); throw failure }
    window.logState("trip-form-keyboard-visible", inspectEditor = true)
    input.performTextReplacement(value)
    check(input.fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.EditableText].text == value) {
        "The trip form must contain the requested text."
    }
    UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack()
    compose.waitUntil(15_000) { !window.keyboardVisible() }
    compose.waitForIdle()
}
