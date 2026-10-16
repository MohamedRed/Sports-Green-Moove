package be.sportgreenmoove.app.ui

import android.content.Context
import android.os.Process
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
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalChatProcessRestartTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private lateinit var activity: ActivityScenario<MainActivity>
    private lateinit var context: Context
    private lateinit var session: JSONObject
    private val first = "Message confirmé avant relancement."
    private val second = "Nouvel envoi après relancement."
    private val reply = "Réponse reçue après relancement."
    private var authenticated = false

    @Test fun prepareConfirmedConversation() = stage("before") { result ->
        AndroidRuntime.create(context).auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            login("parent")
            compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
            waitFor(SgmTestTags.ChatNewConversationAction)
            compose.onNodeWithTag(SgmTestTags.ChatNewConversationAction).performClick()
            waitForText("Trajet relancement QA")
            compose.onNodeWithText("Trajet relancement QA").performScrollTo().performClick()
            waitForText("Aucun message.")
            send(first)
            result.put("firstMessageConfirmed", true)
            captureLocalUi(compose, "local-chat-restart-before.png")
        }
    }

    @Test fun reopenConfirmedConversation() = stage("after") { result ->
        val before = JSONObject(File(directory(), "local-chat-restart-before.json").readText())
        check(before.getString("runId") == session.getString("runId") && before.getBoolean("completed"))
        assertNotEquals("A new app process is required", before.getInt("processId"), Process.myPid())
        AndroidRuntime.create(context)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            waitFor(SgmTestTags.HomeScreen)
            assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
            authenticated = true
            result.put("sessionRestoredWithoutLogin", true)
            openConversation(first)
            waitForText(first)
            assertDraftEmpty()
            result.put("confirmedHistoryRestored", true)
            captureLocalUi(compose, "local-chat-restart-reopened.png")
            send(second)
            result.put("newSendConfirmed", true)
            logout()
            login("driver")
            openConversation(second)
            waitForText(first)
            waitForText(second)
            waitForReadAcknowledgement(second)
            send(reply)
            logout()
            login("parent")
            openConversation(reply)
            waitForText(first)
            waitForText(second)
            waitForText(reply)
            assertDraftEmpty()
            waitForReadAcknowledgement(reply)
            result.put("driverReplyReceived", true).put("bothInboxesRead", true)
            captureLocalUi(compose, "local-chat-restart-reply.png")
        }
    }

    private fun stage(name: String, action: (JSONObject) -> Unit) {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        AndroidRuntime.create(context)
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-ui-confirmed-conversation-restart-stage").put("stage", name)
            .put("processId", Process.myPid()).put("actorUserId", "sgm-qa-parent").put("completed", false)
        try {
            action(result)
            result.put("completed", true)
            write(name, result)
        } catch (failure: Throwable) {
            result.put("completed", false)
            try { write(name, result) } catch (diagnosticFailure: Throwable) { failure.addSuppressed(diagnosticFailure) }
            if (authenticated) runCatching { captureLocalUi(compose, "local-chat-restart-$name-failed.png") }
            throw failure
        }
    }

    private fun login(actor: String) {
        authenticated = false
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextReplacement(session.getString(actor))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextReplacement(session.getString("password"))
        closeKeyboard()
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
        assertEquals(if (actor == "parent") "sgm-qa-parent" else "sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)
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
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled() }.isSuccess
        }
    }
    private fun send(body: String) {
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled().performTextReplacement(body)
        closeKeyboard()
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
        compose.waitUntil(60_000) { draft().isEmpty() }
        waitForText(body)
        compose.waitUntil(60_000) { compose.onAllNodesWithText("Envoi en cours...").fetchSemanticsNodes().isEmpty() }
    }
    private fun closeKeyboard() {
        var visible = false
        activity.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        if (visible) {
            activity.onActivity { it.getSystemService(InputMethodManager::class.java)
                .hideSoftInputFromWindow(it.window.decorView.windowToken, 0) }
            compose.waitUntil(30_000) {
                activity.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
                    ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
                !visible
            }
        }
        compose.waitForIdle()
    }
    private fun waitForReadAcknowledgement(preview: String) {
        val runtime = AndroidRuntime.create(context)
        compose.waitUntil(60_000) {
            runBlocking { runtime.firebase.getInbox().chats.single { it.preview == preview }.unreadCount == 0 }
        }
    }
    private fun draft() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun assertDraftEmpty() { assertEquals("", draft()) }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun waitForText(value: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithText(value).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also {
        check(it.isDirectory || it.mkdirs())
    }
    private fun write(name: String, result: JSONObject) {
        File(directory(), "local-chat-restart-$name.json").writeText(result.toString(2))
    }
}
