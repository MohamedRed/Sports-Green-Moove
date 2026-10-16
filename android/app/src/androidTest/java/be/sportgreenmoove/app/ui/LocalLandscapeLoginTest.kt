package be.sportgreenmoove.app.ui

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.provider.Settings
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalLandscapeLoginTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test
    fun landscapeLoginScrollsToInputsAndSubmit() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        AndroidRuntime.create(context).auth.signOut()
        val device = UiDevice.getInstance(instrumentation)
        val autoRotation = Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0)
        device.setOrientationLeft()
        try {
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                var originalOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                activity.onActivity {
                    originalOrientation = it.requestedOrientation
                    it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                }
                try {
                    compose.waitUntil(15_000) {
                        context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE &&
                            device.displayWidth > device.displayHeight
                    }
                    compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.AuthEmailAction).fetchSemanticsNodes().isNotEmpty() }
                    compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().assertIsDisplayed()
                    captureLocalUi(compose, "local-login-landscape.png", landscape = true)
                    compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString("parent"))
                    compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
                    compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
                    compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.HomeScreen).fetchSemanticsNodes().isNotEmpty() }
                    compose.onNodeWithTag(SgmTestTags.HomeScreen).assertIsDisplayed()
                } finally {
                    activity.onActivity { it.requestedOrientation = originalOrientation }
                }
            }
        } finally {
            device.setOrientationNatural()
            compose.waitUntil(15_000) {
                context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT &&
                    device.displayWidth < device.displayHeight
            }
            instrumentation.waitForIdleSync()
            // Do not enable sensor rotation when the following tests inherited a portrait lock.
            if (autoRotation != 0) device.unfreezeRotation()
        }
    }
}
