package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class LocalEmergencyIdentityFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun recreatedChildRejectsTheOpenFormAndRequiresFreshVerification() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        device.setOrientationNatural()
        val captures = mutableListOf<String>()
        fun capture(name: String) { captureLocalUi(compose, name); captures += name }
        fun checkpoint(step: String, response: String) {
            val pending = File(context.filesDir, "emergency-identity-request.pending")
            pending.writeText(JSONObject().put("runId", session.getString("runId")).put("step", step).toString())
            check(pending.renameTo(File(context.filesDir, "emergency-identity-request.json")))
            val reply = File(context.filesDir, "emergency-identity-response.json")
            compose.waitUntil(75_000) {
                runCatching { JSONObject(reply.readText()).let {
                    it.getString("runId") == session.getString("runId") && it.getString("step") == response
                } }.getOrDefault(false)
            }
        }
        val dial = instrumentation.addMonitor(IntentFilter(Intent.ACTION_DIAL).apply { addDataScheme("tel") }, null, true)
        val direct = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CALL).apply { addDataScheme("tel") }, null, true)
        try {
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                waitFor(hasTestTag(SgmTestTags.AuthEmailAction) and isEnabled())
                compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString("parent"))
                compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
                click(SgmTestTags.AuthEmailAction); waitFor(hasTestTag(SgmTestTags.HomeScreen))
                compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
                compose.onNodeWithText("Paramètres").performScrollTo().performClick(); click("options.emergency")
                click("emergency.children")
                click("emergency.child.${InstrumentationRegistry.getArguments().getString("emergencyVerificationId")}")
                waitFor(hasText("Enfant urgence QA")); waitFor(hasTestTag("emergency.empty"))
                edit("Ancien contact QA", "+12025550127"); click("emergency.save")
                waitFor(hasTestTag("emergency.phone") and hasText("+12025550127"))
                capture("emergency-identity-original.png")
                edit("Ancien formulaire QA", "+12025550128")
                checkpoint("old-form-open", "child-recreated")
                click("emergency.save"); waitFor(hasTestTag("emergency.error"))
                compose.onNodeWithTag("emergency.phone").assertDoesNotExist()
                compose.onNodeWithTag("emergency.dial").assertDoesNotExist()
                capture("emergency-identity-stale-denied.png")
                click("emergency.refresh"); waitFor(hasTestTag("emergency.error"))
                compose.onNodeWithTag("emergency.phone").assertDoesNotExist()
                assertEquals(context.packageName, device.currentPackageName)
                checkpoint("old-access-denied", "parent-verified-again")
                click("emergency.refresh"); waitFor(hasText("Enfant recréé QA")); waitFor(hasTestTag("emergency.empty"))
                compose.onNodeWithText("+12025550127").assertDoesNotExist()
                compose.onNodeWithText("+12025550128").assertDoesNotExist()
                capture("emergency-identity-fresh-empty.png")
                edit("Nouveau contact QA", "+12025550129"); click("emergency.save")
                waitFor(hasTestTag("emergency.phone") and hasText("+12025550129"))
                activity.recreate()
                waitFor(hasTestTag("emergency.phone") and hasText("+12025550129"))
                compose.onNodeWithText("+12025550127").assertDoesNotExist()
                capture("emergency-identity-fresh-restored.png")
                assertEquals(0, dial.hits); assertEquals(0, direct.hits)
                val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
                val hashes = JSONObject()
                captures.forEach { name -> hashes.put(name, MessageDigest.getInstance("SHA-256")
                    .digest(File(directory, name).readBytes()).joinToString("") { "%02x".format(it.toInt() and 255) }) }
                val checks = JSONArray()
                listOf("original-contact-saved-in-app", "open-old-form-write-denied", "old-verification-read-denied",
                    "fresh-verification-does-not-inherit-contact", "new-contact-restored-after-activity-recreation")
                    .forEach { checks.put(JSONObject().put("id", it).put("status", "passed")) }
                File(directory, "emergency-identity-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
                    .put("runId", session.getString("runId")).put("scope", "local-recreated-child-contact-ui-not-own-child-account")
                    .put("checks", checks).put("screenshots", hashes).put("dialIntentCount", dial.hits)
                    .put("directCallIntentCount", direct.hits).put("physicalDevice", false).toString(2))
            }
        } finally {
            instrumentation.removeMonitor(dial); instrumentation.removeMonitor(direct)
            providers.auth.signOut()
        }
    }
    private fun edit(name: String, phone: String) {
        compose.onNodeWithTag("emergency.name").performScrollTo().performTextReplacement(name)
        compose.onNodeWithTag("emergency.phone").performScrollTo().performTextReplacement(phone)
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled())
        compose.onNodeWithTag(tag).performScrollTo().assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
}
