package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalAppFlowTest {
    @get:Rule val compose = createEmptyComposeRule()

    @Test
    fun isolatedParentLoginCalendarSupportAndSessionRestart() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        AndroidRuntime.create(context).auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            waitFor(SgmTestTags.AuthEmailAction)
            compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString("parent"))
            compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().assertIsDisplayed().performClick()
            waitFor(SgmTestTags.HomeScreen)
            compose.waitUntil(60_000) { compose.onAllNodesWithText("U 7/8 · Green Wavre QA Club").fetchSemanticsNodes().isNotEmpty() }
            capture("local-parent-home.png")
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            compose.waitUntil(60_000) { compose.onAllNodesWithText("U 7/8 · Green Wavre QA Club").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("U 7/8 · Green Wavre QA Club").assertIsDisplayed()
            compose.onNodeWithTag("trips.month.next").performClick()
            compose.onNodeWithText("Aucun trajet dans cet onglet.").assertIsDisplayed()
            compose.onNodeWithTag("trips.month.previous").performClick()
            capture("local-trips-calendar.png")
            compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
            waitFor(SgmTestTags.MessagesScreen)
            compose.waitUntil(60_000) { compose.onAllNodesWithText("point de rendez-vous QA", substring = true).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("point de rendez-vous QA", substring = true).assertIsDisplayed()
            capture("local-parent-messages.png")
            compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
            compose.onNodeWithText("Paramètres").performScrollTo().performClick()
            waitFor(SgmTestTags.OptionsScreen)
            compose.onNodeWithTag(SgmTestTags.SupportReportReasonInput).performScrollTo().performTextReplacement("Local app UI test")
            compose.onNodeWithTag(SgmTestTags.SupportReportDescriptionInput).performScrollTo().performTextInput("Disposable support report submitted from the Android app.")
            compose.onNodeWithTag(SgmTestTags.SupportReportAction).performScrollTo().performClick()
            compose.waitUntil(60_000) { compose.onAllNodesWithText("Signalement envoyé:", substring = true).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Signalement envoyé:", substring = true).performScrollTo().assertIsDisplayed()
            capture("local-support-sent.png")
            compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).performClick()
            val preferences = context.getSharedPreferences("appearance", Context.MODE_PRIVATE)
            val previous = preferences.getBoolean("darkTheme", false)
            compose.onNodeWithTag("appearance.toggle").performClick()
            compose.runOnIdle { assertEquals(!previous, preferences.getBoolean("darkTheme", previous)) }
            activity.recreate()
            waitFor(SgmTestTags.HomeScreen)
            compose.runOnIdle { assertEquals(!previous, preferences.getBoolean("darkTheme", previous)) }
            compose.onNodeWithTag("appearance.toggle").assertIsSelected()
            capture("local-theme-after-restart.png")
        }
    }

    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }

    private fun capture(name: String) {
        captureLocalUi(compose, name)
    }
}
