package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import be.sportgreenmoove.app.services.NotificationSettingsResult
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NotificationSettingsFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test fun blockedStatusOpensSettingsWithoutClaimingPermissionWasGranted() {
        var launches = 0
        val state = NotificationSettingsState({ false }, { launches++; NotificationSettingsResult.Opened })
        compose.setSgmUiTestContent { NotificationSettingsContent(state) }
        compose.onNodeWithText("Bloquées sur ce téléphone").assertIsDisplayed()
        compose.onNodeWithTag("settings.notifications").assertHasClickAction().performClick()
        compose.onNodeWithText("Bloquées sur ce téléphone").assertIsDisplayed()
        compose.runOnIdle { assertEquals(1, launches) }
    }

    @Test fun resumingRereadsPermissionButPausingDoesNotInventAnUpdate() {
        val owner = TestOwner(); var allowed = false
        val state = NotificationSettingsState({ allowed }, { NotificationSettingsResult.Opened })
        compose.setSgmUiTestContent {
            CompositionLocalProvider(LocalLifecycleOwner provides owner) {
                NotificationSettingsLifecycle(state); NotificationSettingsContent(state)
            }
        }
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.RESUMED }
        compose.onNodeWithText("Bloquées sur ce téléphone").assertIsDisplayed()
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.STARTED; allowed = true }
        compose.onNodeWithText("Bloquées sur ce téléphone").assertIsDisplayed()
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.RESUMED }
        compose.onNodeWithText("Autorisées sur ce téléphone").assertIsDisplayed()
        compose.runOnIdle { owner.registry.currentState = Lifecycle.State.STARTED; allowed = false; owner.registry.currentState = Lifecycle.State.RESUMED }
        compose.onNodeWithText("Bloquées sur ce téléphone").assertIsDisplayed()
    }

    @Test fun narrowLargeTextKeepsStatusAndOpeningErrorInsideTheControl() {
        val state = NotificationSettingsState({ false }, { NotificationSettingsResult.Denied })
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.5f)) {
                Box(Modifier.width(280.dp).testTag("notification.frame")) { NotificationSettingsContent(state) }
            }
        }
        compose.onNodeWithTag("settings.notifications").performClick()
        val frame = compose.onNodeWithTag("notification.frame").fetchSemanticsNode().boundsInRoot
        for (tag in listOf("settings.notifications.status", "settings.notifications.error")) {
            val node = compose.onNodeWithTag(tag, useUnmergedTree = true); node.assertIsDisplayed()
            val bounds = node.fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        }
        val status = compose.onNodeWithTag("settings.notifications.status", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val error = compose.onNodeWithTag("settings.notifications.error").fetchSemanticsNode().boundsInRoot
        assertTrue(error.top >= status.bottom)
    }

    private class TestOwner : LifecycleOwner {
        val registry = LifecycleRegistry(this)
        override val lifecycle: Lifecycle get() = registry
    }
}
