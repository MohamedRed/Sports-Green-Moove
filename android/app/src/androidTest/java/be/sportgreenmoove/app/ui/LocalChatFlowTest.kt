package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.pm.ActivityInfo
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import kotlin.math.abs

class LocalChatFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val ref = ConversationRef(ConversationKind.Booking, "sgm-qa-booking-approved")
    private lateinit var scenario: ActivityScenario<MainActivity>

    @Test
    fun twoWayConversationDraftHistoryLiveDeliveryAndAccessControl() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            scenario = activity
            activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
            login(session.getString("parent"), session.getString("password"))
            openMessages()
            openConversation("point de rendez-vous QA", substring = true)
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Rendez-vous devant le stade.")
            closeKeyboard()
            compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).performClick()
            openMessages()
            waitForComposer()
            assertDraft("Rendez-vous devant le stade.")
            activity.recreate()
            waitForComposer()
            assertDraft("Rendez-vous devant le stade.")
            activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            compose.waitUntil(15_000) { context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE }
            waitForComposer()
            assertDraft("Rendez-vous devant le stade.")
            captureLocalUi(compose, "local-chat-landscape-draft.png", landscape = true)
            activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
            compose.waitUntil(15_000) { context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT }
            send("Nous serons devant le stade.")
            captureLocalUi(compose, "local-chat-parent-sent.png")
            backToInbox()
            waitForText("Nous serons devant le stade.")
            openConversation("Historique 120")
            verifyHistory(runtime.conversations)
            backToInbox()
            logout()
            login(session.getString("driver"), session.getString("password"))
            openMessages()
            openConversation("Nous serons devant le stade.")
            waitForText("Hermes Parent QA")
            send("Je vous retrouve à l'entrée du stade.")
            captureLocalUi(compose, "local-chat-driver-reply.png")
            logout()
            login(session.getString("parent"), session.getString("password"))
            openMessages()
            openConversation("Je vous retrouve à l'entrée du stade.")
            runBlocking { sendLocalPeerReply(context, session, "J'arrive dans deux minutes.") }
            waitForText("J'arrive dans deux minutes.")
            send("Merci, à tout à l'heure.")
            captureLocalUi(compose, "local-chat-live-reply.png")
            logout()
            login(session.getString("driver"), session.getString("password"))
            openMessages()
            openConversation("Merci, à tout à l'heure.")
            waitForText("Merci, à tout à l'heure.")
            // Wait for the backend read acknowledgement, not only a visible bubble.
            compose.waitUntil(60_000) {
                runBlocking { runtime.firebase.getInbox().chats.single { it.sourceId == ref.sourceId }.unreadCount == 0 }
            }
            logout()
            login(session.getString("outsider"), session.getString("password"))
            openMessages()
            waitForText("Aucune conversation.")
            val failure = runBlocking {
                runCatching { withTimeout(20_000) { runtime.conversations.observeConversation(ref).first() } }.exceptionOrNull()
            }
            assertTrue(failure is FirebaseFunctionsException && failure.code == FirebaseFunctionsException.Code.PERMISSION_DENIED)
        }
    }

    private fun verifyHistory(gateway: be.sportgreenmoove.app.services.ConversationGateway) {
        val history = ConversationRef(ConversationKind.Booking, "sgm-qa-chat-history")
        runBlocking {
            var page = withTimeout(20_000) { gateway.observeConversation(history).first() }
            val ids = page.messages.map { it.id }.toMutableList()
            while (page.olderCursorId != null) {
                page = gateway.loadEarlier(history, page.olderCursorId!!)
                ids.addAll(page.messages.map { it.id })
            }
            assertEquals(120, ids.size)
            assertEquals(120, ids.distinct().size)
            assertEquals((120 downTo 1).map { "sgm-qa-history-${it.toString().padStart(3, '0')}" }, ids)
        }
        repeat(2) {
            compose.onNodeWithTag(SgmTestTags.ChatMessageList).performScrollToNode(hasTestTag(SgmTestTags.ChatLoadEarlierAction))
            compose.onNodeWithTag(SgmTestTags.ChatLoadEarlierAction).assertIsEnabled().performClick()
            val target = if (it == 0) "Historique 021" else "Historique 001"
            compose.waitUntil(30_000) {
                runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageList).performScrollToNode(hasText(target)) }.isSuccess
            }
        }
        compose.onNodeWithText("Historique 001").assertIsDisplayed()
    }

    private fun send(body: String) {
        waitForComposer()
        closeKeyboard()
        val restingTop = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().boundsInRoot.top
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performClick().performTextReplacement(body)
        compose.waitUntil(30_000) { keyboardVisible() }
        closeKeyboard()
        compose.waitUntil(30_000) {
            abs(compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().boundsInRoot.top - restingTop) < 2f
        }
        try {
            compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsDisplayed().assertIsEnabled().performClick()
            compose.waitUntil(30_000) { draft().isEmpty() }
            waitForText(body)
        } catch (failure: Throwable) {
            runCatching { captureLocalUi(compose, "local-chat-send-not-confirmed.png") }
            throw failure
        }
    }

    private fun draft() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun assertDraft(text: String) { assertEquals(text, draft()) }
    private fun closeKeyboard() {
        scenario.onActivity {
            it.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(it.window.decorView.windowToken, 0)
        }
        compose.waitUntil(30_000) { !keyboardVisible() }
        compose.waitForIdle()
    }
    private fun keyboardVisible(): Boolean {
        var visible = false
        scenario.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        return visible
    }
    private fun openMessages() {
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
        compose.waitUntil(60_000) {
            listOf(SgmTestTags.MessagesScreen, SgmTestTags.ChatThreadScreen)
                .any { compose.onAllNodesWithTag(it).fetchSemanticsNodes().isNotEmpty() }
        }
    }
    private fun openConversation(preview: String, substring: Boolean = false) {
        waitForText(preview, substring)
        compose.onNodeWithText(preview, substring = substring).performScrollTo().performClick()
        waitFor(SgmTestTags.ChatThreadScreen)
        waitForComposer()
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsDisplayed()
    }
    private fun backToInbox() { compose.onNodeWithTag(SgmTestTags.BackAction).performClick(); waitFor(SgmTestTags.MessagesScreen) }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailAction)
    }
    private fun login(email: String, password: String) {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(email)
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(password)
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    private fun waitForComposer() {
        waitFor(SgmTestTags.ChatMessageInput)
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled() }.isSuccess
        }
    }
    private fun waitForText(text: String, substring: Boolean = false) {
        compose.waitUntil(60_000) { compose.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty() }
    }
}
