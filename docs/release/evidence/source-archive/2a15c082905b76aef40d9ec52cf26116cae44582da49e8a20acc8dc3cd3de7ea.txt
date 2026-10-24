package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.FirebaseAndroidTeamConversationGateway
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
    @Test fun currentTeamExchangeDraftRecreationRevocationAndAccountSwitchUseActualServices() = with(LocalTeamChatUi(compose)) {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa"); val fixture = session.getJSONObject("teamChat")
        val providers = AndroidRuntime.create(context); providers.auth.signOut()
        val reads = FirebaseAndroidTeamConversationGateway()
        fun unread(uid: String): Long = runBlocking {
            var cursor: String? = null
            repeat(20) {
                val page = reads.choices(uid, fixture.getString("clubId"), cursor)
                page.items.firstOrNull { it.id == fixture.getString("teamId") &&
                    it.teamInstanceId == fixture.getString("teamInstanceId") }?.let { return@runBlocking requireNotNull(it.unreadCount) }
                cursor = page.nextCursor ?: error("Test team not discoverable")
            }
            error("Test team directory exceeded its bound")
        }
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        var peerMessageId = ""; var parentMessageId = ""; var revokeRequestId = ""
        // Keep both SDK peers alive until the activity and all account operations have closed.
        runBlocking { LocalTeamChatPeer.open(context, session, "driver") }.use { driver ->
            runBlocking { LocalTeamChatPeer.open(context, session, "manager") }.use { manager ->
                ActivityScenario.launch(MainActivity::class.java).use { activity ->
                    login(session, "parent")
                    val parentUid = "sgm-qa-parent"
                    assertEquals(1L, unread(parentUid)); open(fixture)
                    waitFor(hasText("Bonjour équipe QA")); compose.onNodeWithText("Message avant arrivée QA").assertDoesNotExist()
                    compose.waitUntil(20_000) { unread(parentUid) == 0L }
                    capture("team-chat-native-parent")
                    peerMessageId = runBlocking { driver.send("Réponse conducteur QA") }
                    waitFor(hasText("Réponse conducteur QA"))
                    compose.waitUntil(20_000) { unread(parentUid) == 0L }
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
                    val driverUid = "sgm-qa-driver"
                    compose.waitUntil(20_000) { unread(driverUid) == 0L }
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
}
