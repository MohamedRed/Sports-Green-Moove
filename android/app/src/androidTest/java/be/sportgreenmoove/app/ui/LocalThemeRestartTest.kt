package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test

/** Run in a separate instrumentation process after LocalAppFlowTest. */
class LocalThemeRestartTest {
    @get:Rule val compose = createEmptyComposeRule()

    @Test
    fun savedThemeIsRestoredInANewAppProcess() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertTrue(context.getSharedPreferences("appearance", Context.MODE_PRIVATE).getBoolean("darkTheme", false))
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.HomeScreen).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithTag("appearance.toggle").assertIsSelected()
            captureLocalUi(compose, "local-theme-after-process-restart.png")
        }
    }
}
