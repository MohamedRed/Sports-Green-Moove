package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalLedgerHistoryFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun completeHistorySurvivesActivityRecreationAndAccountSwitch() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val device = UiDevice.getInstance(instrumentation)
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val providers = AndroidRuntime.create(context)
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        providers.auth.signOut()
        try {
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                login("ledger@example.test", session.getString("password"))
                val reward = runBlocking { providers.firebase.getRewardSummary() }
                val impact = runBlocking { providers.firebase.getImpactSummary() }
                assertEquals(-22_000, reward.balanceCents); assertEquals(8, reward.entries.size)
                assertEquals(321.25, impact.totalCo2Kg, 0.0); assertEquals(257, impact.rideCount)
                compose.onNodeWithTag(SgmTestTags.HomeImpactAction).performScrollTo().performClick()
                waitFor(hasText("257 trajets")); compose.onNodeWithText("321,3").assertIsDisplayed()
                compose.onNodeWithText("257 km partagés").assertIsDisplayed()
                captureLocalUi(compose, "ledger-history-impact.png")
                back(); profile(); rewards("-220,00")
                captureLocalUi(compose, "ledger-history-balance.png")
                activity.recreate(); waitFor(hasText("-220,00")); captureLocalUi(compose, "ledger-history-restored.png")
                back(); logout(); login("ledger-foreign@example.test", session.getString("password")); profile(); rewards("9999,99")
                compose.onNodeWithText("-220,00").assertDoesNotExist(); captureLocalUi(compose, "ledger-history-foreign.png")
                back(); logout(); login("ledger@example.test", session.getString("password")); profile(); rewards("-220,00")
                captureLocalUi(compose, "ledger-history-return.png")
                back(); logout()
                val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
                File(directory, "ledger-history-device.json").writeText(JSONObject()
                    .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
                    .put("scope", "connected-isolated-android-ledger-history-not-physical")
                    .put("completed", true).put("balanceCents", -22_000).put("totalCo2Kg", 321.25)
                    .put("rideCount", 257).put("historyCount", 8).put("activityRecreation", true)
                    .put("accountSwitch", true).put("fullProcessRestart", false).toString())
            }
        } finally {
            providers.auth.signOut()
            runBlocking { FirebaseFirestore.getInstance().terminate().await() }
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
    private fun rewards(value: String) {
        compose.onNodeWithText("RÉCOMPENSES").performScrollTo().performClick(); waitFor(hasText(value))
        compose.onNodeWithText(value).assertIsDisplayed()
    }
    private fun back() { compose.onNodeWithTag(SgmTestTags.BackAction).performScrollTo().performClick() }
    private fun logout() { compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick() }
    private fun waitFor(matcher: SemanticsMatcher) = compose.waitUntil(60_000) {
        compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty()
    }
}
