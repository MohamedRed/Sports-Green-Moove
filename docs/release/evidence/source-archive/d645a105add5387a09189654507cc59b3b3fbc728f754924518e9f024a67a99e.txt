package be.sportgreenmoove.app.ui

import android.content.Context
import android.os.Process
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
import java.security.MessageDigest

class LocalSessionDisconnectTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val scope = "local-session-disconnect-process-restart-not-physical-network-loss"

    @Test fun disconnectFromFailedRestoration() {
        val (context, session) = fixture()
        val runtime = AndroidRuntime.create(context)
        val functions = FirebaseFunctions.getInstance()
        val port = InstrumentationRegistry.getArguments().getString("sessionFaultPort")!!.toInt()
        check(port in 1024..65535)
        val screenshots = JSONObject()
        var failure: Throwable? = null
        try {
            runtime.auth.signOut()
            runBlocking { runtime.auth.signIn(session.getString("parent"), session.getString("password")) }
            assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
            functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port)
            ActivityScenario.launch(MainActivity::class.java).use {
                waitFor("session.restore.error")
                compose.onNodeWithTag("session.restore.error").assertIsDisplayed()
                compose.onNodeWithTag("session.restore.retry").performScrollTo().assertIsDisplayed()
                compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
                compose.onNodeWithTag(SgmTestTags.HomeScreen).assertDoesNotExist()
                compose.onNodeWithText("private-qa-session-error-detail", substring = true).assertDoesNotExist()
                assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
                capture(context, screenshots, "error")
                compose.onNodeWithTag("session.restore.disconnect").performScrollTo().performClick()
                signedOutScreen()
                capture(context, screenshots, "signed-out")
                val checkpoint = JSONObject().put("scope", scope + "-checkpoint")
                    .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
                    .put("processId", Process.myPid()).put("uidBefore", "sgm-qa-parent")
                    .put("initialFailureVisible", true).put("noImplicitDisconnect", true)
                    .put("explicitDisconnectReachedSignIn", true).put("authEmptyAfterDisconnect", true)
                    .put("screenshots", screenshots).put("physicalDevice", false)
                File(context.filesDir, "local-session-disconnect-checkpoint.json").writeText(checkpoint.toString(2))
                File(directory(context), "local-session-disconnect-before.json").writeText(checkpoint.toString(2))
            }
        } catch (error: Throwable) { failure = error }
        finally {
            fun cleanup(action: () -> Unit) {
                try { action() } catch (error: Throwable) {
                    val previous = failure
                    if (previous == null) failure = error else previous.addSuppressed(error)
                }
            }
            cleanup { functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001) }
            cleanup { runtime.auth.signOut() }
            cleanup { runBlocking { FirebaseFirestore.getInstance().terminate().await() } }
        }
        failure?.let { throw it }
    }

    @Test fun reopenSignedOutSessionInNewProcess() {
        val (context, session) = fixture()
        val before = JSONObject(File(context.filesDir, "local-session-disconnect-checkpoint.json").readText())
        check(before.getString("scope") == scope + "-checkpoint")
        check(before.getString("projectId") == "demo-sgm-local-qa" && before.getString("runId") == session.getString("runId"))
        check(before.getBoolean("explicitDisconnectReachedSignIn") && before.getBoolean("authEmptyAfterDisconnect"))
        assertNotEquals(before.getInt("processId"), Process.myPid())
        AndroidRuntime.create(context)
        assertNull("Signed-out SDK identity must persist before the app opens", FirebaseAuth.getInstance().currentUser)
        val screenshots = before.getJSONObject("screenshots")
        try {
            ActivityScenario.launch(MainActivity::class.java).use {
                signedOutScreen()
                capture(context, screenshots, "reopened")
            }
        } finally { runBlocking { FirebaseFirestore.getInstance().terminate().await() } }
        assertNull(FirebaseAuth.getInstance().currentUser)
        File(directory(context), "local-session-disconnect-device.json").writeText(JSONObject()
            .put("scope", scope).put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("preparedProcessId", before.getInt("processId")).put("processId", Process.myPid())
            .put("screenshots", screenshots).put("authEmptyBeforeLaunch", true)
            .put("signedOutScreenAfterProcessRestart", true).put("authEmptyAfterLaunch", true)
            .put("firestoreClientTerminated", true).put("physicalDevice", false)
            .put("realNetworkLossVerified", false).put("completed", true).toString(2))
    }

    private fun fixture(): Pair<Context, JSONObject> {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && args.containsKey("sessionFaultPort"))
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        return context to session
    }
    private fun signedOutScreen() {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.HomeScreen).assertDoesNotExist()
        compose.onNodeWithTag("session.restore.error").assertDoesNotExist()
        assertNull(FirebaseAuth.getInstance().currentUser)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
    private fun directory(context: Context) = File(context.getExternalFilesDir(null), "local-ui-evidence")
        .also { check(it.isDirectory || it.mkdirs()) }
    private fun capture(context: Context, screenshots: JSONObject, id: String) {
        val name = "local-session-disconnect-$id.png"
        captureLocalUi(compose, name)
        screenshots.put(name, MessageDigest.getInstance("SHA-256").digest(File(directory(context), name).readBytes())
            .joinToString("") { "%02x".format(it) })
    }
}
