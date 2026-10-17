package be.sportgreenmoove.app.ui

import android.content.Context
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import kotlin.math.abs

class LocalChatNetworkFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private lateinit var activity: ActivityScenario<MainActivity>
    private lateinit var session: JSONObject
    private var authenticated = false
    private val body = "Connexion rétablie, rendez-vous confirmé."
    private val reply = "Bien reçu après la coupure."
    private val privateDraft = "Brouillon privé du parent QA."

    @Test fun networkLossRetainsTheDraftAndExplicitRetryDoesNotDuplicateTheMessage() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        AndroidRuntime.create(context).auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        val device = UiDevice.getInstance(instrumentation)
        device.setOrientationNatural()
        val result = JSONObject().put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId"))
            .put("scope", "native-ui-with-disposable-os-network-control").put("completed", false)
        val network = JSONArray()
        result.put("network", network)
        result.put("setupMethod", "requested-wifi-and-cellular-networks")
        result.put("transportSetupVersion", 2)
        result.put("handoverObservationVersion", 1)
        var phase = "login"
        var networkControl: LocalEmulatorNetwork? = null
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            try {
                login("parent")
                phase = "booking-picker"
                compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
                waitFor(SgmTestTags.ChatNewConversationAction)
                compose.onNodeWithTag(SgmTestTags.ChatNewConversationAction).performClick()
                waitForText("Trajet reprise réseau QA")
                captureLocalUi(compose, "local-chat-network-booking-options.png")
                compose.onNodeWithText("Trajet reprise réseau QA").performScrollTo().performClick()
                waitForText("Aucun message.")
                captureLocalUi(compose, "local-chat-network-empty.png")
                typeDraft(body)
                val control = LocalEmulatorNetwork(context, device, session)
                networkControl = control
                control.use {
                    phase = "network-preparation"
                    result.put("preparation", control.snapshot("preparing"))
                    writeResult(context, result)
                    var preparedEvidence: JSONObject? = null
                    try { compose.waitUntil(30_000) {
                        preparedEvidence = control.preparedSnapshot()
                        preparedEvidence != null
                    } }
                    catch (failure: Throwable) {
                        try {
                            result.put("preparationFailure", control.snapshot("preparation-failed"))
                            writeResult(context, result)
                        } catch (diagnosticFailure: Throwable) { failure.addSuppressed(diagnosticFailure) }
                        throw failure
                    }
                    network.put(checkNotNull(preparedEvidence))
                    writeResult(context, result)
                    phase = "disconnect"
                    try {
                        control.disconnect {
                            var cellularEvidence: JSONObject? = null
                            compose.waitUntil(30_000) {
                                cellularEvidence = control.cellularReadySnapshot()
                                cellularEvidence != null
                            }
                            network.put(checkNotNull(cellularEvidence))
                            writeResult(context, result)
                        }
                        compose.waitUntil(30_000) { control.offline() }
                        assertFalse("The actual Functions endpoint must be unreachable", control.backendReachable())
                    } catch (failure: Throwable) {
                        network.put(control.snapshot("disconnect-failed"))
                        writeResult(context, result)
                        throw failure
                    }
                    network.put(control.snapshot("offline"))
                    phase = "offline-send"
                    compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
                    waitForText("Envoi non confirmé. Réessayez.", 90_000)
                    assertDraft(body)
                    compose.onNodeWithTag(SgmTestTags.ChatSendAction)
                        .assertIsEnabled().assertContentDescriptionEquals("Réessayer l'envoi")
                    result.put("offlineSendUnconfirmed", true).put("offlineDraftRetained", true)
                    captureLocalUi(compose, "local-chat-network-unconfirmed.png")
                    phase = "restore"
                    control.restore()
                    var restoredEvidence: JSONObject? = null
                    compose.waitUntil(30_000) {
                        restoredEvidence = control.restoredSnapshot()
                        restoredEvidence != null
                    }
                    network.put(checkNotNull(restoredEvidence))
                    phase = "retry-send"
                    compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
                    waitForText(body)
                    compose.waitUntil(60_000) { draft().isEmpty() }
                    waitForSendFinished()
                    result.put("recoveredSendConfirmed", true)
                    captureLocalUi(compose, "local-chat-network-recovered.png")
                }
                assertFalse("The cellular test request must be released", control.cellularRequestRegistered)
                assertFalse("The Wi-Fi test request must be released", control.wifiRequestRegistered)
                result.put("cellularRequestReleased", true)
                result.put("wifiRequestReleased", true)
                phase = "account-draft"
                typeDraft(privateDraft)
                assertDraft(privateDraft)
                logout()
                login("driver")
                openConversation(body)
                assertDraft("")
                waitForReadAcknowledgement(context)
                result.put("accountDraftCleared", true)
                typeDraft(reply)
                compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
                waitForText(reply)
                compose.waitUntil(60_000) { draft().isEmpty() }
                waitForSendFinished()
                captureLocalUi(compose, "local-chat-network-other-account.png")
                logout()
                login("parent")
                openConversation(reply)
                waitForText(body)
                waitForText(reply)
                assertDraft("")
                waitForReadAcknowledgement(context)
                result.put("replyReceived", true).put("completed", true)
                captureLocalUi(compose, "local-chat-network-received.png")
                writeResult(context, result)
            } catch (failure: Throwable) {
                result.put("completed", false).put("failedPhase", phase)
                result.put("cellularRequestReleased", networkControl?.let { !it.cellularRequestRegistered } ?: JSONObject.NULL)
                result.put("wifiRequestReleased", networkControl?.let { !it.wifiRequestRegistered } ?: JSONObject.NULL)
                writeResult(context, result)
                if (authenticated) {
                    runCatching { captureLocalUi(compose, "local-chat-network-failed.png") }
                    runCatching { device.takeScreenshot(File(evidenceDirectory(context), "local-chat-network-device-failed.png")) }
                }
                throw failure
            }
        }
    }

    private fun login(key: String) {
        authenticated = false
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performClick().assertIsFocused()
        compose.waitUntil(30_000) { keyboardVisible() }
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performTextReplacement(session.getString(key))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextReplacement(session.getString("password"))
        closeKeyboard()
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
        assertEquals(if (key == "parent") "sgm-qa-parent" else "sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)
        authenticated = true
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        authenticated = false
        waitFor(SgmTestTags.AuthEmailAction)
    }
    private fun openConversation(preview: String) {
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
        waitForText(preview)
        compose.onNodeWithText(preview).performScrollTo().performClick()
        waitFor(SgmTestTags.ChatMessageInput)
        compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled() }.isSuccess }
    }
    private fun closeKeyboard() {
        if (keyboardVisible()) {
            activity.onActivity { it.getSystemService(InputMethodManager::class.java)
                .hideSoftInputFromWindow(it.window.decorView.windowToken, 0) }
            compose.waitUntil(30_000) { !keyboardVisible() }
        }
        compose.waitForIdle()
    }
    private fun typeDraft(value: String) {
        closeKeyboard()
        val input = compose.onNodeWithTag(SgmTestTags.ChatMessageInput)
        val restingTop = input.fetchSemanticsNode().boundsInRoot.top
        input.assertIsEnabled().performClick().assertIsFocused()
        compose.waitUntil(30_000) { keyboardVisible() }
        input.performTextReplacement(value)
        closeKeyboard()
        compose.waitUntil(30_000) { abs(input.fetchSemanticsNode().boundsInRoot.top - restingTop) < 2f }
        assertDraft(value)
    }
    private fun keyboardVisible(): Boolean {
        var visible = false
        activity.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        return visible
    }
    private fun draft() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun waitForSendFinished() {
        compose.waitUntil(60_000) { compose.onAllNodesWithText("Envoi en cours...").fetchSemanticsNodes().isEmpty() }
    }
    private fun waitForReadAcknowledgement(context: Context) {
        val runtime = AndroidRuntime.create(context)
        compose.waitUntil(60_000) {
            runBlocking { runtime.firebase.getInbox().chats.single { it.preview == body || it.preview == reply }.unreadCount == 0 }
        }
    }
    private fun assertDraft(value: String) { assertEquals(value, draft()) }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun waitForText(value: String, timeout: Long = 60_000) {
        compose.waitUntil(timeout) { compose.onAllNodesWithText(value).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun evidenceDirectory(context: Context) = File(context.getExternalFilesDir(null), "local-ui-evidence").also {
        check(it.isDirectory || it.mkdirs())
    }
    private fun writeResult(context: Context, result: JSONObject) {
        File(evidenceDirectory(context), "local-chat-network-ui.json").writeText(result.toString(2))
    }
}
