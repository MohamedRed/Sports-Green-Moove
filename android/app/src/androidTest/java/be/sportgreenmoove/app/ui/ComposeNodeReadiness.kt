package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.ComposeTestRule

internal fun ComposeTestRule.waitForComposeNode(matcher: SemanticsMatcher, timeoutMillis: Long) {
    waitUntil(timeoutMillis) {
        onAllNodes(matcher).fetchSemanticsNodes(atLeastOneRootRequired = false).isNotEmpty()
    }
}
