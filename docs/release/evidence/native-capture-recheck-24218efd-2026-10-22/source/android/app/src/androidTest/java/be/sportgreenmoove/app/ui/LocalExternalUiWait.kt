package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.ComposeTestRule

internal fun awaitLocalExternalUi(compose: ComposeTestRule, timeoutMillis: Long, visible: () -> Boolean,
    observe: (Boolean) -> Unit) {
    var appeared = false
    // Poll through Compose so completed SDK callbacks can resume queued UI effects.
    val outcome = runCatching { compose.waitUntil(timeoutMillis) { visible().also { appeared = it } } }
    val diagnostic = runCatching { observe(appeared) }
    outcome.exceptionOrNull()?.let { failure ->
        diagnostic.exceptionOrNull()?.let(failure::addSuppressed)
        throw failure
    }
    diagnostic.getOrThrow()
    check(appeared) { "The external UI condition must actually become visible" }
}
