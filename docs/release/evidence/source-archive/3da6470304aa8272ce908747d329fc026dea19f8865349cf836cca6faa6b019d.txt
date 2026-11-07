package be.sportgreenmoove.app.ui

import android.content.res.Configuration
import android.provider.Settings
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class LocalSessionRestorationTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test fun failedRestorationSurvivesRotationAndExplicitRetryKeepsTheSameParent() {
        val arguments = InstrumentationRegistry.getArguments()
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && arguments.containsKey("sessionFaultPort"))
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        val port = arguments.getString("sessionFaultPort")!!.toInt().also { check(it in 1024..65535) }
        val runtime = AndroidRuntime.create(context)
        val auth = FirebaseAuth.getInstance()
        val functions = FirebaseFunctions.getInstance()
        val autoRotation = Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0)
        check(device.displayRotation == 0)
        check(Settings.System.getInt(context.contentResolver, Settings.System.USER_ROTATION, 0) == 0)
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
        val transport = LocalSessionTransportDiagnostics(context, device, session, port)
        val captures = JSONObject()
        fun capture(id: String, landscape: Boolean) {
            val name = "local-session-restoration-$id.png"
            captureLocalUi(compose, name, landscape = landscape)
            captures.put(name, MessageDigest.getInstance("SHA-256").digest(File(directory, name).readBytes())
                .joinToString("") { "%02x".format(it) })
        }
        var orientationRestored = false
        var failure: Throwable? = null
        try {
            transport.checkpoint("before-sign-in")
            runtime.auth.signOut()
            runBlocking { runtime.auth.signIn(session.getString("parent"), session.getString("password")) }
            transport.checkpoint("signed-in")
            assertEquals("sgm-qa-parent", auth.currentUser?.uid)
            functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port)
            transport.checkpoint("launching-app")
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                var initialActivity: MainActivity? = null
                activity.onActivity { initialActivity = it }
                failedScreen()
                transport.checkpoint("initial-error")
                assertEquals(1, control(port, session, "state").getInt("restorationAttempts"))
                capture("error", false)
                device.setOrientationLeft()
                orientation(context, device, Configuration.ORIENTATION_LANDSCAPE)
                compose.waitUntil(60_000) {
                    control(port, session, "state").getInt("restorationAttempts") == 2 &&
                        compose.onAllNodesWithTag("session.restore.error").fetchSemanticsNodes().isNotEmpty()
                }
                activity.onActivity { assertNotSame(initialActivity, it) }
                failedScreen(); transport.checkpoint("rotated-error"); capture("rotated-error", true)
                assertEquals("recover", control(port, session, "recover").getString("phase"))
                compose.onNodeWithTag("session.restore.retry").performScrollTo().performClick()
                readyScreen(); transport.checkpoint("recovered"); capture("recovered", true)
                assertEquals(3, control(port, session, "state").getInt("restorationAttempts"))
                var landscapeActivity: MainActivity? = null
                activity.onActivity { landscapeActivity = it }
                device.setOrientationNatural()
                orientation(context, device, Configuration.ORIENTATION_PORTRAIT)
                compose.waitUntil(60_000) {
                    control(port, session, "state").getInt("restorationAttempts") == 4 &&
                        compose.onAllNodesWithTag(SgmTestTags.HomeScreen).fetchSemanticsNodes().isNotEmpty()
                }
                readyScreen()
                transport.checkpoint("restored")
                activity.onActivity { assertNotSame(landscapeActivity, it) }
                assertEquals(4, control(port, session, "state").getInt("restorationAttempts"))
                capture("restored", false)
                compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
                compose.onNodeWithText("HERMES PARENT QA").assertIsDisplayed()
                compose.onNodeWithText(session.getString("parent"), substring = true).assertIsDisplayed()
                assertEquals("sgm-qa-parent", auth.currentUser?.uid)
                capture("identity", false)
                transport.checkpoint("identity-verified")
            }
        } catch (error: Throwable) {
            failure = error
            try { transport.checkpoint("failure") } catch (diagnostic: Throwable) { error.addSuppressed(diagnostic) }
        }
        finally {
            fun cleanup(action: () -> Unit) {
                try { action() } catch (error: Throwable) {
                    val previous = failure
                    if (previous == null) failure = error else previous.addSuppressed(error)
                }
            }
            cleanup { functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001) }
            cleanup { runtime.auth.signOut(); assertNull(auth.currentUser) }
            cleanup {
                device.setOrientationNatural()
                orientation(context, device, Configuration.ORIENTATION_PORTRAIT)
                if (autoRotation != 0) device.unfreezeRotation()
                assertEquals(autoRotation, Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0))
                assertEquals(0, Settings.System.getInt(context.contentResolver, Settings.System.USER_ROTATION, 0))
                orientationRestored = true
            }
            cleanup { runBlocking { FirebaseFirestore.getInstance().terminate().await() } }
        }
        failure?.let { throw it }
        assertNull(auth.currentUser)
        File(directory, "local-session-restoration-device.json").writeText(JSONObject()
            .put("scope", "local-session-restoration-ui-not-physical-network-loss")
            .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("uid", "sgm-qa-parent").put("screenshots", captures)
            .put("initialFailureVisible", true).put("failureSurvivedRotation", true)
            .put("explicitRetryRecoveredSameParent", true).put("healthyRotationRestoredSameParent", true)
            .put("profileIdentityVerified", true).put("restorationAttempts", 4)
            .put("orientationRestored", orientationRestored).put("parentSignedOut", true)
            .put("firestoreClientTerminated", true).put("physicalDevice", false)
            .put("realNetworkLossVerified", false).put("completed", true).toString(2))
    }

    private fun failedScreen() {
        waitFor("session.restore.error")
        compose.onNodeWithTag("session.restore.error").assertIsDisplayed()
        compose.onNodeWithTag("session.restore.retry").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("session.restore.disconnect").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.HomeScreen).assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
        compose.onNodeWithText("private-qa-session-error-detail", substring = true).assertDoesNotExist()
        assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
    }
    private fun readyScreen() {
        waitFor(SgmTestTags.HomeScreen)
        compose.onNodeWithTag(SgmTestTags.HomeScreen).assertIsDisplayed()
        compose.onNodeWithTag("session.restore.error").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
        assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
    private fun orientation(context: android.content.Context, device: UiDevice, expected: Int) {
        compose.waitUntil(15_000) { context.resources.configuration.orientation == expected &&
            (device.displayWidth > device.displayHeight) == (expected == Configuration.ORIENTATION_LANDSCAPE) }
    }
    private fun control(port: Int, session: JSONObject, action: String): JSONObject {
        check(action in setOf("state", "recover"))
        val connection = URL("http://${BuildConfig.SGM_FIREBASE_EMULATOR_HOST}:$port/__qa/$action").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.doOutput = true
            connection.connectTimeout = 5_000; connection.readTimeout = 5_000
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(JSONObject().put("runId", session.getString("runId")).toString().toByteArray()) }
            assertEquals(200, connection.responseCode)
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
}
