package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.FirebaseAndroidConversationGateway
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.test.StandardTestDispatcher
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class LocalChatResponseLossTest {
    @get:Rule val compose = createComposeRule(effectContext = StandardTestDispatcher())
    private val body = "Un seul message malgré une réponse perdue."
    private val uncertain = "Envoi non confirmé. Réessayez."

    @Test fun committedMessageSurvivesALostReplyAndRejectedRetryWithoutDuplication() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val arguments = InstrumentationRegistry.getArguments()
        val port = requireNotNull(arguments.getString("faultPort")).toInt().also { check(it in 1024..65535) }
        val bookingId = requireNotNull(arguments.getString("faultBookingId")).also { check(it.isNotBlank()) }
        AndroidRuntime.create(context)
        val options = FirebaseApp.getInstance().options
        check(options.projectId == "demo-sgm-local-qa")
        val app = FirebaseApp.initializeApp(context, options, "local-loss-${UUID.randomUUID()}")
        val auth = FirebaseAuth.getInstance(app)
        val functions = FirebaseFunctions.getInstance(app)
        val firestore = FirebaseFirestore.getInstance()
        auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
        functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port)
        val visible = mutableStateOf(true)
        val result = JSONObject().put("projectId", options.projectId).put("runId", session.getString("runId"))
            .put("sourceId", bookingId).put("scope", "native-sdk-controlled-post-commit-reply-loss").put("completed", false)
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
        try {
            runBlocking {
                FirebaseAuth.getInstance().signInWithEmailAndPassword(session.getString("parent"), session.getString("password")).await()
                auth.signInWithEmailAndPassword(session.getString("parent"), session.getString("password")).await()
            }
            assertEquals("sgm-qa-parent", auth.currentUser?.uid)
            val gateway = FirebaseAndroidConversationGateway(firestore, functions, auth)
            compose.setSgmUiTestContent {
                if (visible.value) ConversationRoute(ConversationRef(ConversationKind.Booking, bookingId), gateway, onBack = {})
            }
            waitForText("Aucun message.")
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled()
            // Keep the independent live-query acknowledgement from masking the uncertain callable result.
            runBlocking { firestore.disableNetwork().await() }
            result.put("firestoreAcknowledgementDeferred", true)
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput(body)
            closeKeyboard()
            compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
            waitForUncertain()
            result.put("initialReplyLost", true)
            captureLocalUi(compose, "local-chat-loss-unconfirmed.png")
            phase(port, session.getString("runId"), "reject")
            compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
            waitForUncertain()
            result.put("rejectedRetryRetained", true)
            captureLocalUi(compose, "local-chat-loss-rejected-retry.png")
            phase(port, session.getString("runId"), "recover")
            compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
            compose.waitUntil(60_000) { draft().isEmpty() }
            result.put("finalSendConfirmed", true)
            runBlocking { firestore.enableNetwork().await() }
            result.put("networkRestored", true)
            waitForText(body)
            assertEquals(1, compose.onAllNodesWithText(body, substring = false).fetchSemanticsNodes().size)
            assertEquals("", draft())
            captureLocalUi(compose, "local-chat-loss-confirmed.png")
            result.put("completed", true)
        } finally {
            compose.runOnIdle { visible.value = false }
            compose.waitForIdle()
            runBlocking { firestore.enableNetwork().await() }
            result.put("networkRestored", true)
            File(directory, "local-chat-loss-ui.json").writeText(result.toString(2))
            auth.signOut()
            app.delete()
            FirebaseAuth.getInstance().signOut()
        }
    }

    private fun waitForUncertain() {
        compose.waitUntil(60_000) {
            compose.onAllNodesWithText(uncertain).fetchSemanticsNodes().isNotEmpty() &&
                runCatching { compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled() }.isSuccess
        }
        assertEquals(body, draft())
        runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextReplacement("Autre message") }
        assertEquals("A pending intent must not become editable", body, draft())
        compose.onAllNodesWithText(body, substring = false).assertCountEquals(1)
    }
    private fun draft() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun waitForText(value: String) = compose.waitUntil(60_000) {
        compose.onAllNodesWithText(value).fetchSemanticsNodes().isNotEmpty()
    }
    private fun closeKeyboard() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync {
            val activity = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).single()
            activity.getSystemService(android.view.inputmethod.InputMethodManager::class.java)
                .hideSoftInputFromWindow(activity.window.decorView.windowToken, 0)
        }
        compose.waitUntil(30_000) {
            var visible = true
            instrumentation.runOnMainSync {
                val activity = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).single()
                visible = ViewCompat.getRootWindowInsets(activity.window.decorView)?.isVisible(WindowInsetsCompat.Type.ime()) == true
            }
            !visible
        }
        compose.waitForIdle()
    }
    private fun phase(port: Int, runId: String, phase: String) {
        val connection = URL("http://${BuildConfig.SGM_FIREBASE_EMULATOR_HOST}:$port/__qa/phase").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.doOutput = true
            connection.connectTimeout = 10_000; connection.readTimeout = 10_000
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(JSONObject().put("runId", runId).put("phase", phase).toString().toByteArray()) }
            assertEquals(200, connection.responseCode)
            assertEquals(phase, JSONObject(connection.inputStream.bufferedReader().use { it.readText() }).getString("phase"))
        } finally { connection.disconnect() }
    }
}
