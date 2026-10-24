package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
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
import java.security.MessageDigest

class LocalGuardianVerificationFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun parentRequestManagerDecisionWithdrawalReopenRestartAndAccountIsolation() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(session.getString("parent"), session.getString("password")); openGuardians()
            click("guardian.child"); click("guardian.option.sgm-qa-child-lina")
            click("guardian.club"); click("guardian.option.sgm-qa-club-green-wavre"); click("guardian.review")
            status("Aucune demande"); click("guardian.action.request"); click("guardian.keep")
            val initial = runBlocking { providers.firebase.guardianView("sgm-qa-parent", "sgm-qa-club-green-wavre", "sgm-qa-child-lina") }
            assertNull(initial.status)
            action("request"); status("En attente"); captureLocalUi(compose, "guardian-parent-requested.png")
            runBlocking { LocalGuardianPeer.open(context, session) }.use { peer ->
                runBlocking { peer.decide("refuse") }
                status("En attente"); action("withdraw")
                waitFor(hasTestTag("guardian.error")); compose.onNodeWithTag("guardian.current").assertDoesNotExist()
                refresh(); status("Demande refusée"); action("request"); status("En attente")
                runBlocking { peer.decide("verify") }; refresh(); status("Parent vérifié")
                captureLocalUi(compose, "guardian-parent-verified.png")
                val current = runBlocking { providers.firebase.guardianView("sgm-qa-parent", "sgm-qa-club-green-wavre", "sgm-qa-child-lina") }
                val id = current.id
                activity.recreate(); waitFor(hasTestTag("guardian.screen")); click("guardian.history.$id"); status("Parent vérifié")
                captureLocalUi(compose, "guardian-parent-restored.png")
                action("withdraw"); status("Demande retirée"); action("request"); status("En attente")
                runBlocking { peer.decide("verify"); peer.decide("revoke") }; refresh(); status("Vérification retirée")
                captureLocalUi(compose, "guardian-parent-revoked.png")
            }
            click(SgmTestTags.BackAction); click(SgmTestTags.BackAction)
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login(session.getString("driver"), session.getString("password")); openGuardians()
            waitFor(hasText("Aucune demande.")); compose.onNodeWithTag("guardian.current").assertDoesNotExist()
            compose.onNodeWithText(requireNotNull(initial.childName)).assertDoesNotExist()
            captureLocalUi(compose, "guardian-parent-other-account.png")
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
            val files = listOf("guardian-parent-requested.png", "guardian-parent-verified.png", "guardian-parent-restored.png",
                "guardian-parent-revoked.png", "guardian-parent-other-account.png")
            val hashes = JSONObject()
            files.forEach { name -> hashes.put(name, MessageDigest.getInstance("SHA-256").digest(File(directory, name).readBytes())
                .joinToString("") { "%02x".format(it.toInt() and 255) }) }
            val checks = org.json.JSONArray()
            for (name in listOf("parent-request-ui", "cancel-without-write", "stale-withdrawal-refused", "manager-refusal-reopen",
                "manager-verified-visible", "activity-recreation-fresh-read", "parent-withdraw-reopen-manager-revoke", "account-isolation"))
                checks.put(JSONObject().put("id", name).put("status", "passed"))
            File(directory, "guardian-parent-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
                .put("runId", session.getString("runId")).put("scope", "local-native-parent-ui-with-local-sdk-manager-not-physical")
                .put("checks", checks).put("screenshots", hashes).toString(2))
        }
    }
    private fun action(wire: String) { click("guardian.action.$wire"); click("guardian.confirm") }
    private fun refresh() { click(SgmTestTags.GroupsRefreshAction) }
    private fun status(value: String) {
        waitFor(hasTestTag("guardian.status") and hasText(value)); compose.onNodeWithTag("guardian.status").performScrollTo().assertTextEquals(value)
    }
    private fun openGuardians() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("Mon club").performScrollTo().performClick(); click("groups.guardian"); waitFor(hasTestTag("guardian.screen"))
    }
    private fun login(email: String, password: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction))
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("guardian.confirm", "guardian.keep")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
}
