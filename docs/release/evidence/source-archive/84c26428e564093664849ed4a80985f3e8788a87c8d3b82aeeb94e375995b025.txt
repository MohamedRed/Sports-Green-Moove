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
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class LocalTeamEnrollmentFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun requestsDecisionsRecreationWithdrawalAndVerificationLossUseActualStorage() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        var selfId = ""; var childId = ""; var revokeRequestId = ""
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(session.getString("parent"), session.getString("password")); openTeams(); chooseTeam(); review(); status("Aucune demande")
            click("team-enrollment.action.request"); click("team-enrollment.keep")
            val initial = runBlocking { providers.firebase.teamEnrollmentView("sgm-qa-parent", "sgm-qa-team-ui-team", null) }
            assertNull(initial.status); assertEquals(0L, initial.revision); selfId = initial.id
            action("request"); status("En attente"); captureLocalUi(compose, "team-native-requested.png")
            runBlocking { LocalTeamEnrollmentPeer.open(context, session) }.use { peer ->
                runBlocking { peer.decide("sgm-qa-parent", "refuse") }; review(); status("Inscription refusée")
                action("request"); status("En attente")
                runBlocking { peer.decide("sgm-qa-parent", "approve") }; review(); status("Inscription approuvée")
                captureLocalUi(compose, "team-native-approved.png")
                activity.recreate(); waitFor(hasTestTag("team-enrollment.screen")); chooseTeam(); review(); status("Inscription approuvée")
                assertEquals(selfId, runBlocking { providers.firebase.teamEnrollmentView("sgm-qa-parent", "sgm-qa-team-ui-team", null) }.id)
                click("team-enrollment.action.withdraw"); click("team-enrollment.keep")
                assertEquals(4L, runBlocking { providers.firebase.teamEnrollmentView("sgm-qa-parent", "sgm-qa-team-ui-team", null) }.revision)
                action("withdraw"); status("Inscription retirée")
                click("team-enrollment.subject.true"); click("team-enrollment.child"); click("team-enrollment.option.sgm-qa-team-ui-child")
                review(); status("Aucune demande"); action("request"); status("En attente")
                runBlocking { peer.decide("sgm-qa-team-ui-child", "approve") }; review(); status("Inscription approuvée")
                val child = runBlocking { providers.firebase.teamEnrollmentView("sgm-qa-parent", "sgm-qa-team-ui-team", "sgm-qa-team-ui-child") }
                childId = child.id; assertNotEquals(selfId, childId); assertEquals(2L, child.revision)
                captureLocalUi(compose, "team-native-child-approved.png")
                revokeRequestId = runBlocking { peer.revokeGuardian() }
                action("withdraw"); waitFor(hasTestTag("team-enrollment.error"))
                compose.onNodeWithTag("team-enrollment.status").assertDoesNotExist()
                review(); status("Inscription approuvée")
                for (wire in listOf("request", "withdraw")) compose.onNodeWithTag("team-enrollment.action.$wire").assertDoesNotExist()
                val denied = runBlocking { providers.firebase.teamEnrollmentView("sgm-qa-parent", "sgm-qa-team-ui-team", "sgm-qa-team-ui-child") }
                assertFalse(denied.eligible); assertNull(denied.subjectName); assertTrue(denied.allowedActions.isEmpty()); assertEquals(2L, denied.revision)
                captureLocalUi(compose, "team-native-child-ineligible.png")
                runBlocking { peer.decide("sgm-qa-team-ui-child", "revoke") }; review(); status("Inscription révoquée")
            }
            click(SgmTestTags.BackAction); click(SgmTestTags.BackAction)
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login(session.getString("driver"), session.getString("password")); openTeams(); click("team-enrollment.club")
            compose.onNodeWithTag("team-enrollment.option.sgm-qa-team-ui-club").assertDoesNotExist()
            compose.onNodeWithText("Enfant inscriptions QA").assertDoesNotExist()
            compose.onNodeWithText("Fermer", useUnmergedTree = true).performClick()
            compose.waitUntil(60_000) { compose.onAllNodes(isDialog()).fetchSemanticsNodes().isEmpty() }
            captureLocalUi(compose, "team-native-other-account.png")
        }
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        val hashes = JSONObject(); val checks = JSONArray()
        for (file in listOf("team-native-requested.png", "team-native-approved.png", "team-native-child-approved.png",
            "team-native-child-ineligible.png", "team-native-other-account.png"))
            hashes.put(file, MessageDigest.getInstance("SHA-256").digest(File(directory, file).readBytes())
                .joinToString("") { "%02x".format(it.toInt() and 255) })
        for (id in listOf("cancel-without-write", "parent-request-ui", "manager-refusal-refresh", "new-request-manager-approval",
            "activity-recreation-reselection-fresh-read", "confirmed-owned-withdrawal", "verified-parent-child-request-approval",
            "revoked-parent-stale-withdrawal-denied", "manager-revoke-visible", "account-isolation"))
            checks.put(JSONObject().put("id", id).put("status", "passed"))
        File(directory, "team-enrollment-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("scope", "local-native-team-ui-with-sdk-manager-not-physical")
            .put("selfEnrollmentId", selfId).put("childEnrollmentId", childId).put("guardianRevokeRequestId", revokeRequestId)
            .put("checks", checks).put("screenshots", hashes).toString(2))
    }
    private fun chooseTeam() {
        click("team-enrollment.club"); click("team-enrollment.option.sgm-qa-team-ui-club")
        click("team-enrollment.team"); click("team-enrollment.option.sgm-qa-team-ui-team")
    }
    private fun review() { click("team-enrollment.review") }
    private fun action(wire: String) { click("team-enrollment.action.$wire"); click("team-enrollment.confirm") }
    private fun status(value: String) {
        waitFor(hasTestTag("team-enrollment.status") and hasText(value))
        compose.onNodeWithTag("team-enrollment.status").performScrollTo().assertTextEquals(value)
    }
    private fun openTeams() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("Mon club").performScrollTo().performClick(); click("groups.team-enrollment")
        waitFor(hasTestTag("team-enrollment.screen"))
    }
    private fun login(email: String, password: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction))
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("team-enrollment.confirm", "team-enrollment.keep") && !tag.startsWith("team-enrollment.option.")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
}
