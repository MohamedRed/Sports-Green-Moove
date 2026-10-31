package be.sportgreenmoove.app.ui

import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.window.Dialog
import org.junit.Rule
import org.junit.Test

class InputWindowReadinessTest {
    @get:Rule val compose = createComposeRule()

    @Test fun activityInputUsesItsOwnFocusedWindowAndRealKeyboard() = checkInput(dialog = false)
    @Test fun dialogInputUsesItsOwnFocusedWindowAndRealKeyboard() = checkInput(dialog = true)

    private fun checkInput(dialog: Boolean) {
        compose.setSgmUiTestContent {
            var text by remember { mutableStateOf("") }
            val field: @Composable () -> Unit = {
                OutlinedTextField(text, { text = it }, Modifier.testTag("readiness.input"))
            }
            if (dialog) Dialog(onDismissRequest = {}) { field() } else field()
        }
        val input = compose.onNodeWithTag("readiness.input")
        val window = InputWindowReadiness(compose, input)
        window.awaitFocus(5_000)
        input.performClick().assertIsFocused()
        try { compose.waitUntil(5_000) { window.keyboardVisible() } }
        catch (failure: Throwable) { window.logState("readiness-probe-keyboard-failed", inspectEditor = true); throw failure }
        window.logState(if (dialog) "dialog-keyboard-visible" else "activity-keyboard-visible", inspectEditor = true)
        input.performTextReplacement("QA input")
        input.assertTextEquals("QA input")
    }
}
