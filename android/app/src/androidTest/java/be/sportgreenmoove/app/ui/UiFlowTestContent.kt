package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import be.sportgreenmoove.app.design.SgmTheme

fun ComposeContentTestRule.setSgmUiTestContent(content: @Composable () -> Unit) {
    setContent {
        SgmTheme(darkTheme = false) {
            V2ThemeToggleProvider(darkTheme = false, onToggle = {}) {
                content()
            }
        }
    }
}
