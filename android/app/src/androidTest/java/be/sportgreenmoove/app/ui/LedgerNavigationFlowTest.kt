package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LedgerNavigationFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun impactBackReturnsToProfile() {
        var back = 0
        compose.setSgmUiTestContent { ImpactScreen(UiFlowFixtures.impact, onBack = { back += 1 }) }
        compose.onNodeWithTag(SgmTestTags.BackAction).performClick()
        assertEquals(1, back)
    }

    @Test
    fun rewardsBackReturnsToProfile() {
        var back = 0
        compose.setSgmUiTestContent { RewardsScreen(UiFlowFixtures.rewards, onBack = { back += 1 }) }
        compose.onNodeWithTag(SgmTestTags.BackAction).performClick()
        assertEquals(1, back)
    }
}
