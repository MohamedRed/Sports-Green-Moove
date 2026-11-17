package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalProfileCityFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun actualProfileSaveRecreationAccountSwitchAndRemoval() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val device = UiDevice.getInstance(instrumentation)
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        device.setOrientationNatural()
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(session.getString("parent"), session.getString("password")); profile(); cityText("Non renseignée")
            open(); compose.onNodeWithTag("city.input").performTextReplacement("Wavre")
            compose.onNodeWithTag("city.cancel").performClick(); cityText("Non renseignée")
            assertNull(runBlocking { providers.profileCity.readProfileCity("sgm-qa-parent") }.city)
            open(); compose.onNodeWithTag("city.input").performTextReplacement("Liège")
            assertEquals("Liège", compose.onNodeWithTag("city.input").fetchSemanticsNode().config[SemanticsProperties.EditableText].text)
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence"); check(directory.isDirectory || directory.mkdirs())
            check(device.takeScreenshot(File(directory, "profile-city-editor-window.png")))
            captureLocalUi(compose, "profile-city-editor.png", landscape = true, dialog = true)
            compose.onNodeWithTag("city.save").performClick(); cityText("Liège")
            captureLocalUi(compose, "profile-city-saved.png")
            val saved = runBlocking { providers.profileCity.readProfileCity("sgm-qa-parent") }
            assertEquals("Liège", saved.city); assertEquals(1L, saved.revision)
            activity.recreate(); cityText("Liège"); captureLocalUi(compose, "profile-city-restored.png")
            logout(); login(session.getString("driver"), session.getString("password")); profile(); cityText("Non renseignée")
            compose.onNodeWithText("Liège", useUnmergedTree = true).assertDoesNotExist()
            captureLocalUi(compose, "profile-city-other-account.png")
            open(); compose.onNodeWithTag("city.input").performTextReplacement("Namur")
            compose.onNodeWithTag("city.save").performClick(); cityText("Namur")
            logout(); login(session.getString("parent"), session.getString("password")); profile(); cityText("Liège")
            open(); compose.onNodeWithTag("city.remove").performClick(); cityText("Non renseignée")
            captureLocalUi(compose, "profile-city-removed.png")
            val removed = runBlocking { providers.profileCity.readProfileCity("sgm-qa-parent") }
            assertNull(removed.city); assertEquals(2L, removed.revision)
            File(directory, "profile-city-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
                .put("runId", session.getString("runId")).put("completed", true)
                .put("scope", "connected-isolated-android-profile-city-not-physical")
                .put("activityRecreation", true).put("fullProcessRestart", false)
                .put("parentRevision", 2).put("driverRevision", 1).toString())
            logout()
        }
    }
    private fun login(email: String, password: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction) and isEnabled())
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextReplacement(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextReplacement(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun profile() { compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick() }
    private fun open() { compose.onNodeWithTag("profile.city").performScrollTo().performClick(); waitFor(hasTestTag("city.input")) }
    private fun cityText(value: String) {
        waitFor(hasTestTag("profile.city") and hasText(value))
        compose.onNodeWithTag("profile.city").performScrollTo()
    }
    private fun logout() { compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick() }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
}
