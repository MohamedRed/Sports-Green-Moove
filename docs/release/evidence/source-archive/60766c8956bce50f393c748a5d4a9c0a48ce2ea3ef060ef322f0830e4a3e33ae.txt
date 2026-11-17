package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.lifecycle.Lifecycle
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

class LocalTeamConversationFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun currentTeamExchangeDraftRecreationRevocationAndAccountSwitchUseActualServices() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa"); val fixture = session.getJSONObject("teamChat")
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        var peerMessageId = ""; var parentMessageId = ""; var revokeRequestId = ""
        // Keep both SDK peers alive until the activity and all account operations have closed.
        runBlocking { LocalTeamChatPeer.open(context, session, "driver") }.use { driver ->
            runBlocking { LocalTeamChatPeer.open(context, session, "manager") }.use { manager ->
                ActivityScenario.launch(MainActivity::class.java).use { activity ->
                    login(session, "parent"); open(fixture)
                    waitFor(hasText("Bonjour équipe QA")); compose.onNodeWithText("Message avant arrivée QA").assertDoesNotExist()
                    capture("team-chat-native-parent")
                    peerMessageId = runBlocking { driver.send("Réponse conducteur QA") }
                    waitFor(hasText("Réponse conducteur QA"))
                    send("Message parent QA")
                    parentMessageId = runBlocking { driver.observeParentMessage("Message parent QA") }
                    capture("team-chat-native-exchange")
                    compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput("Brouillon privé parent QA")
                    activity.recreate(); waitFor(hasTestTag(SgmTestTags.ChatMessageInput) and isEnabled())
                    compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertTextContains("Brouillon privé parent QA")
                    waitFor(hasText("Équipe conversations QA"))
                    compose.onNodeWithText("ÉQUIPE").assertIsDisplayed()
                    compose.onNodeWithText("Équipe conversations QA").assertIsDisplayed()
                    waitFor(hasText("Message parent QA")); capture("team-chat-native-draft")
                    activity.moveToState(Lifecycle.State.CREATED)
                    revokeRequestId = runBlocking { manager.revokeParent() }
                    activity.moveToState(Lifecycle.State.RESUMED)
                    waitFor(hasTestTag("team-chat.retry"))
                    for (body in listOf("Message parent QA", "Bonjour équipe QA", "Réponse conducteur QA", "Brouillon privé parent QA"))
                        compose.onNodeWithText(body).assertDoesNotExist()
                    compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
                    capture("team-chat-native-revoked")
                    click(SgmTestTags.BackAction); waitFor(hasTestTag("team-chat.directory"))
                    assertFalse(findChoice(fixture.getString("teamId")))
                    click(SgmTestTags.BottomNavProfileAction)
                    compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
                    login(session, "driver"); open(fixture)
                    waitFor(hasText("Message parent QA"))
                    compose.onNodeWithTag("team-chat.messages").performScrollToNode(hasText("Message avant arrivée QA"))
                    compose.onNodeWithText("Message avant arrivée QA").assertIsDisplayed()
                    compose.onNodeWithTag("team-chat.messages").performScrollToIndex(0)
                    assertEquals("", inputText())
                    compose.onNodeWithText("Brouillon privé parent QA").assertDoesNotExist()
                    send("Message conducteur après changement QA")
                    capture("team-chat-native-driver")
                }
            }
        }
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence"); val hashes = JSONObject()
        for (stem in listOf("parent", "exchange", "draft", "revoked", "driver")) for (suffix in listOf(".png", "-window.png")) {
            val name = "team-chat-native-$stem$suffix"
            hashes.put(name, MessageDigest.getInstance("SHA-256").digest(File(directory, name).readBytes()).joinToString("") { "%02x".format(it) })
        }
        val checks = JSONArray()
        for (id in listOf("approved-team-discovery", "no-pre-admission-parent-history", "driver-sdk-message-received",
            "parent-ui-message-independently-read", "draft-survives-activity-recreation", "revocation-in-background-hides-thread-on-return",
            "revoked-team-not-discoverable", "driver-account-does-not-recover-parent-draft", "driver-ui-send-after-account-switch"))
            checks.put(JSONObject().put("id", id).put("status", "passed"))
        File(directory, "team-conversation-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("scope", "local-native-team-conversation-with-sdk-peers-not-physical-or-push")
            .put("checks", checks).put("screenshots", hashes).put("peerMessageId", peerMessageId)
            .put("parentMessageId", parentMessageId).put("guardianRevokeRequestId", revokeRequestId).toString(2))
    }
    private fun login(session: JSONObject, role: String) {
        waitFor(hasTestTag(SgmTestTags.AuthEmailAction))
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString(role))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(hasTestTag(SgmTestTags.HomeScreen))
    }
    private fun open(fixture: JSONObject) {
        click(SgmTestTags.BottomNavMessagesAction); click("team-chat.tab")
        assertTrue(findChoice(fixture.getString("clubId"))); click("team-chat.choice.${fixture.getString("clubId")}")
        assertTrue(findChoice(fixture.getString("teamId"))); click("team-chat.choice.${fixture.getString("teamId")}")
        waitFor(hasTestTag(SgmTestTags.ChatMessageInput) and isEnabled())
    }
    private fun findChoice(id: String): Boolean {
        repeat(30) {
            compose.waitUntil(60_000) {
                compose.onAllNodesWithText("Chargement...").fetchSemanticsNodes().isEmpty() &&
                    (compose.onAllNodes(SemanticsMatcher("team choices") {
                        it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("team-chat.choice.") == true
                    }).fetchSemanticsNodes().isNotEmpty() ||
                        compose.onAllNodesWithTag("team-chat.choices-more").fetchSemanticsNodes().isNotEmpty() ||
                        listOf("Aucun club disponible.", "Aucune équipe approuvée.").any { label ->
                            compose.onAllNodesWithText(label).fetchSemanticsNodes().isNotEmpty() })
            }
            if (compose.onAllNodesWithTag("team-chat.choice.$id").fetchSemanticsNodes().isNotEmpty()) return true
            if (compose.onAllNodesWithTag("team-chat.choices-more").fetchSemanticsNodes().isEmpty()) return false
            click("team-chat.choices-more")
        }
        error("Team directory did not terminate")
    }
    private fun inputText() = compose.onNodeWithTag(SgmTestTags.ChatMessageInput).fetchSemanticsNode()
        .config[SemanticsProperties.EditableText].text
    private fun send(body: String) {
        compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput(body); click(SgmTestTags.ChatSendAction)
        compose.waitUntil(60_000) { inputText().isEmpty() }; waitFor(hasText(body))
    }
    private fun capture(stem: String) {
        captureLocalUi(compose, "$stem.png")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val file = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence/$stem-window.png")
        check(UiDevice.getInstance(instrumentation).takeScreenshot(file))
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); compose.onNodeWithTag(tag).performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() }
    }
}
