package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.pm.ActivityInfo
import android.view.inputmethod.InputMethodManager
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
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

class LocalConversationDirectoryFlowTest {
    @get:Rule val compose = createEmptyComposeRule()
    private lateinit var scenario: ActivityScenario<MainActivity>
    private val tripTitle = "Nouveau trajet de discussion QA"

    @Test fun discoversOldConversationsAndStartsTheFirstExchangeFromAReservation() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            scenario = activity
            activity.onActivity {
                it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                @Suppress("DEPRECATION")
                val mode = it.window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST
                @Suppress("DEPRECATION")
                val expected = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                assertEquals(expected, mode)
            }
            login(session.getString("parent"), session.getString("password"))
            val oldest = runBlocking {
                val first = runtime.conversations.loadConversations()
                val second = runtime.conversations.loadConversations(checkNotNull(first.nextCursor))
                assertEquals(20, first.items.size)
                assertEquals(7, second.items.size)
                assertEquals(27, (first.items + second.items).map { it.ref }.distinct().size)
                second.items.last()
            }
            openMessages()
            compose.onNodeWithTag(SgmTestTags.ChatInboxList).performScrollToNode(hasTestTag(SgmTestTags.ChatInboxEarlierAction))
            compose.onNodeWithTag(SgmTestTags.ChatInboxEarlierAction).assertIsEnabled().performClick()
            compose.waitUntil(30_000) {
                runCatching { compose.onNodeWithTag(SgmTestTags.ChatInboxList).performScrollToNode(hasText(oldest.title)) }.isSuccess
            }
            compose.onNodeWithText(oldest.title).performClick()
            readyComposer()
            waitForText(oldest.preview)
            compose.waitUntil(30_000) {
                runBlocking { (runtime.conversations.loadConversations().nextCursor?.let {
                    runtime.conversations.loadConversations(it).items.single { item -> item.ref == oldest.ref }.unreadCount
                }) == 0L }
            }
            captureLocalUi(compose, "local-chat-directory-history.png")
            backToInbox()
            val booking = runBlocking { runtime.conversations.loadBookingOptions().items.single { it.title == tripTitle } }
            compose.onNodeWithTag(SgmTestTags.ChatNewConversationAction).performClick()
            waitFor(SgmTestTags.ChatBookingScreen)
            val bookingTag = "${SgmTestTags.ChatBookingOptionAction}.${booking.ref.sourceId}"
            waitFor(bookingTag)
            compose.onNodeWithText(tripTitle).assertIsDisplayed()
            captureLocalUi(compose, "local-chat-directory-reservation.png")
            compose.onNodeWithTag(bookingTag).performClick()
            readyComposer()
            waitForText("Aucun message.")
            assertTrue(runBlocking { withTimeout(20_000) { runtime.conversations.observeConversation(booking.ref).first() }.messages.isEmpty() })
            captureLocalUi(compose, "local-chat-directory-empty.png")
            send("Bonjour, pouvons-nous confirmer le rendez-vous ?")
            captureLocalUi(compose, "local-chat-directory-first-message.png")
            backToInbox()
            compose.onNodeWithTag(SgmTestTags.ChatInboxList).performScrollToIndex(0)
            waitForText("Bonjour, pouvons-nous confirmer le rendez-vous ?")
            logout()
            login(session.getString("driver"), session.getString("password"))
            openMessages()
            openLatest("Bonjour, pouvons-nous confirmer le rendez-vous ?")
            compose.onNodeWithText(tripTitle).assertIsDisplayed()
            compose.waitUntil(30_000) {
                runBlocking { runtime.conversations.loadConversations().items.single { it.ref == booking.ref }.unreadCount == 0L }
            }
            send("Oui, rendez-vous devant le stade.")
            captureLocalUi(compose, "local-chat-directory-reply.png")
            logout()
            login(session.getString("parent"), session.getString("password"))
            openMessages()
            openLatest("Oui, rendez-vous devant le stade.")
            compose.waitUntil(30_000) {
                runBlocking { runtime.conversations.loadConversations().items.single { it.ref == booking.ref }.unreadCount == 0L }
            }
            captureLocalUi(compose, "local-chat-directory-received.png")
        }
    }

    private fun send(body: String) {
        readyComposer()
        assertTrue("The resting layout must have no keyboard", !keyboardVisible())
        val restingInputTop = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().boundsInRoot.top
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performClick()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput(body)
        compose.waitUntil(30_000) { keyboardVisible() }
        assertConversationControls()
        val diagnostics = JSONObject().put("restingInputTop", restingInputTop)
            .put("typing", layoutState())
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsEnabled().performClick()
        compose.waitUntil(30_000) {
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
                .config[SemanticsProperties.EditableText].text.isEmpty()
        }
        waitForText(body)
        compose.waitUntil(30_000) { compose.onAllNodesWithText("Envoi en cours...").fetchSemanticsNodes().isEmpty() }
        assertConversationControls()
        diagnostics.put("acknowledged", layoutState())
        scenario.onActivity { it.getSystemService(InputMethodManager::class.java)
            .hideSoftInputFromWindow(it.window.decorView.windowToken, 0) }
        compose.waitUntil(30_000) { !keyboardVisible() }
        try {
            compose.waitUntil(30_000) {
                abs(compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode().boundsInRoot.top - restingInputTop) < 2f
            }
            assertConversationControls()
        } finally {
            diagnostics.put("dismissed", layoutState())
            val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "local-ui-evidence")
            check(directory.isDirectory || directory.mkdirs())
            val phase = if (body.startsWith("Bonjour")) "parent" else "driver"
            File(directory, "keyboard-$phase-layout.json").writeText(diagnostics.toString(2))
            captureLocalUi(compose, "keyboard-$phase-dismissed.png")
        }
    }
    private fun layoutState() = JSONObject().put("keyboardVisible", keyboardVisible()).apply {
        for ((name, tag) in listOf("header" to SgmTestTags.BackAction, "composer" to SgmTestTags.ChatMessageInput)) {
            val bounds = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot
            put(name, JSONObject().put("top", bounds.top).put("bottom", bounds.bottom)
                .put("left", bounds.left).put("right", bounds.right))
        }
    }
    private fun keyboardVisible(): Boolean {
        var visible = false
        scenario.onActivity { visible = ViewCompat.getRootWindowInsets(it.window.decorView)
            ?.isVisible(WindowInsetsCompat.Type.ime()) == true }
        return visible
    }
    private fun assertConversationControls() {
        compose.onNodeWithTag(SgmTestTags.BackAction).assertIsDisplayed()
        compose.onNodeWithText("CONVERSATION").assertIsDisplayed()
        compose.onNodeWithText(tripTitle).assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.ChatSendAction).assertIsDisplayed()
    }
    private fun openLatest(preview: String) {
        compose.onNodeWithTag(SgmTestTags.ChatInboxList).performScrollToIndex(0)
        waitForText(preview)
        compose.onNodeWithText(preview).performClick()
        readyComposer()
        waitForText(preview)
    }
    private fun backToInbox() { compose.onNodeWithTag(SgmTestTags.BackAction).performClick(); waitFor(SgmTestTags.MessagesScreen) }
    private fun openMessages() {
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
        waitFor(SgmTestTags.ChatInboxList)
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.ChatOpenAction).fetchSemanticsNodes().isNotEmpty() }
    }
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
    private fun readyComposer() {
        waitFor(SgmTestTags.ChatMessageInput)
        compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled() }.isSuccess }
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    private fun waitForText(text: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }
}
