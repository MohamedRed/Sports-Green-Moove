package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.EmergencyContactTarget
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.regex.Pattern

class LocalEmergencyContactFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val phone = "+12025550123"
    @Test fun actualContactSaveRevocationRecreationDialerRemovalAndAccountIsolation() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val device = UiDevice.getInstance(instrumentation); check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val providers = AndroidRuntime.create(context); providers.auth.signOut(); device.setOrientationNatural()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        var managerRequestId: String; var dialerPackage: String
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(session.getString("parent"), session.getString("password")); openContacts()
            waitFor(hasTestTag("emergency.empty")); edit("Contact personnel QA", phone); click("emergency.save"); waitForPhone(phone)
            waitFor(hasTestTag("emergency.dial") and isEnabled()); captureLocalUi(compose, "emergency-self-saved.png")
            activity.recreate(); waitForPhone(phone); captureLocalUi(compose, "emergency-self-restored.png")
            click("emergency.children"); click("emergency.child.${InstrumentationRegistry.getArguments().getString("emergencyVerificationId")}")
            waitFor(hasText("Enfant urgence QA")); waitFor(hasTestTag("emergency.empty"))
            edit("Contact enfant QA", "+12025550124"); click("emergency.save"); waitForPhone("+12025550124")
            waitFor(hasTestTag("emergency.dial") and isEnabled()); captureLocalUi(compose, "emergency-child-saved.png")
            runBlocking { LocalEmergencyPeer.open(context, session) }.use { peer -> managerRequestId = runBlocking { peer.revoke() } }
            click("emergency.dial"); waitFor(hasTestTag("emergency.error"))
            compose.onNodeWithTag("emergency.phone").assertDoesNotExist(); compose.onNodeWithTag("emergency.dial").assertDoesNotExist()
            assertEquals(context.packageName, device.currentPackageName); captureLocalUi(compose, "emergency-child-revoked.png")
            click("emergency.self"); waitForPhone(phone); waitFor(hasTestTag("emergency.dial") and isEnabled())
            val resolved = device.executeShellCommand("cmd package resolve-activity --brief -a android.intent.action.DIAL -d tel:$phone").trim().lineSequence().last()
            dialerPackage = resolved.substringBefore('/')
            check(resolved.contains('/') && Regex("[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+").matches(dialerPackage))
            check(dialerPackage != context.packageName)
            val dial = instrumentation.addMonitor(IntentFilter(Intent.ACTION_DIAL).apply { addDataScheme("tel") }, null, false)
            val directCall = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CALL).apply { addDataScheme("tel") }, null, false)
            try {
                click("emergency.dial"); check(device.wait(Until.hasObject(By.pkg(dialerPackage)), 60_000))
                assertEquals(dialerPackage, device.currentPackageName)
                val digits = phone.filter(Char::isDigit)
                check(device.findObjects(By.text(Pattern.compile(".*555.*"))).any { it.text.orEmpty().filter(Char::isDigit) == digits })
                assertEquals(1, dial.hits); assertEquals(0, directCall.hits)
                captureEmergencyDialer(context, device)
                repeat(3) {
                    if (device.currentPackageName != context.packageName) {
                        check(device.currentPackageName == dialerPackage); device.pressBack(); device.waitForIdle()
                    }
                }
                assertEquals(context.packageName, device.currentPackageName)
            } finally { instrumentation.removeMonitor(dial); instrumentation.removeMonitor(directCall) }
            waitForPhone(phone); click("emergency.remove"); click("emergency.keep")
            val retained = runBlocking { providers.emergencyContacts.readEmergencyContact("sgm-qa-parent", EmergencyContactTarget.Self) }
            assertEquals(1L, retained.revision); assertEquals(phone, retained.contact?.phone)
            click("emergency.remove"); click("emergency.confirm"); waitFor(hasTestTag("emergency.empty"))
            val removed = runBlocking { providers.emergencyContacts.readEmergencyContact("sgm-qa-parent", EmergencyContactTarget.Self) }
            assertNull(removed.contact); assertEquals(2L, removed.revision); captureLocalUi(compose, "emergency-self-removed.png")
            click(SgmTestTags.BackAction); click(SgmTestTags.BackAction)
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login(session.getString("driver"), session.getString("password")); openContacts(); waitFor(hasTestTag("emergency.empty"))
            compose.onNodeWithText(phone).assertDoesNotExist(); compose.onNodeWithText("Contact personnel QA").assertDoesNotExist()
            compose.onNodeWithTag("emergency.dial").assertDoesNotExist(); captureLocalUi(compose, "emergency-other-account.png")
            writeEmergencyDeviceEvidence(context, session.getString("runId"), dialerPackage, managerRequestId)
        }
    }
    private fun openContacts() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("Paramètres").performScrollTo().performClick(); click("options.emergency")
        waitFor(hasTestTag("emergency.screen"))
    }
    private fun login(email: String, password: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction) and isEnabled())
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun edit(name: String, number: String) {
        compose.onNodeWithTag("emergency.name").performScrollTo().performTextReplacement(name)
        compose.onNodeWithTag("emergency.phone").performScrollTo().performTextReplacement(number)
    }
    private fun waitForPhone(number: String) { waitFor(hasTestTag("emergency.phone") and hasText(number)) }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("emergency.confirm", "emergency.keep")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
}
