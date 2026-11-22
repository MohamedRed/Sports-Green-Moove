package be.sportgreenmoove.app.ui

import android.content.Context
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalTeamAccessFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun multipleChildrenAndTeamsRefreshCurrentHistoryWithoutMergingConversations() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val fixture = session.getJSONObject("teamChat"); val access = session.getJSONObject("teamAccess")
        val other = TeamConversationTarget(access.getString("otherTeamId"), access.getString("otherTeamInstanceId"))
        AndroidRuntime.create(context).auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        val ui = LocalTeamChatUi(compose); val checks = JSONArray(); val events = JSONObject(); val messages = JSONObject()
        fun passed(id: String) { checks.put(JSONObject().put("id", id).put("status", "passed")) }
        fun capture(id: String) = ui.capture("team-access-$id")
        runBlocking { LocalTeamChatPeer.open(context, session, "driver") }.use { driver ->
            runBlocking { LocalTeamChatPeer.open(context, session, "manager") }.use { manager ->
                ActivityScenario.launch(MainActivity::class.java).use {
                    ui.login(session, "parent"); ui.open(fixture); ui.waitFor(hasText("Bonjour équipe QA"))
                    ui.absent("Message avant arrivée QA"); passed("original-approved-team-visible-without-pre-admission-history")
                    capture("initial")
                    ui.click(SgmTestTags.BackAction); assertFalse(ui.findChoice(other.teamId))
                    passed("pending-other-team-not-listed"); ui.openTeam(fixture.getString("teamId"))
                    events.put("secondChildApproval", runBlocking { manager.approveChild(fixture.getString("teamId"), access.getString("secondChildId")) })
                    ui.waitFor(hasText("Bonjour équipe QA")); passed("second-child-grant-keeps-current-first-child-history")
                    messages.put("afterSecond", runBlocking { driver.send("Message après second enfant QA") })
                    ui.waitFor(hasText("Message après second enfant QA"))
                    events.put("firstRevocation", runBlocking { manager.revokeParent(fixture.getString("childId")) })
                    ui.absent("Bonjour équipe QA"); ui.waitFor(hasText("Message après second enfant QA"))
                    compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertIsEnabled()
                    passed("first-revocation-keeps-only-remaining-grant-history"); capture("remaining")
                    events.put("secondRevocation", runBlocking { manager.revokeParent(access.getString("secondChildId")) })
                    ui.waitFor(hasTestTag("team-chat.retry")); ui.absent("Message après second enfant QA", "Bonjour équipe QA")
                    compose.onNodeWithTag(SgmTestTags.ChatMessageInput).assertDoesNotExist()
                    passed("last-revocation-hides-content-and-composer"); capture("revoked")
                    ui.click(SgmTestTags.BackAction); assertFalse(ui.findChoice(fixture.getString("teamId")))
                    assertFalse(ui.findChoice(other.teamId)); passed("no-team-listed-without-current-grant")
                    events.put("renewal", runBlocking { manager.renewParent(fixture.getString("childId")) })
                    ui.click("team-chat.directory-refresh"); ui.openTeam(fixture.getString("teamId"))
                    ui.absent("Bonjour équipe QA", "Message après second enfant QA")
                    messages.put("afterRenewal", runBlocking { driver.send("Message après nouvel accord QA") })
                    ui.waitFor(hasText("Message après nouvel accord QA")); ui.absent("Bonjour équipe QA", "Message après second enfant QA")
                    passed("renewed-guardian-starts-new-native-history"); capture("renewed")
                    ui.click(SgmTestTags.BackAction); assertFalse(ui.findChoice(other.teamId))
                    passed("pending-other-team-remains-hidden-after-renewal")
                    events.put("otherTeamApproval", runBlocking { manager.approveChild(other.teamId, fixture.getString("childId")) })
                    ui.click("team-chat.directory-refresh"); ui.openTeam(other.teamId)
                    ui.absent("Autre équipe avant accord QA", "Message après nouvel accord QA")
                    messages.put("otherIncoming", runBlocking { driver.send("Message nouvelle équipe QA", other) })
                    ui.waitFor(hasText("Message nouvelle équipe QA")); ui.absent("Autre équipe avant accord QA", "Message après nouvel accord QA")
                    passed("separate-team-approval-excludes-old-and-other-team-history")
                    ui.send("Réponse seconde équipe QA")
                    messages.put("otherReply", runBlocking { driver.observeParentMessage("Réponse seconde équipe QA", other) })
                    passed("other-team-ui-reply-independently-read"); capture("other")
                    ui.click(SgmTestTags.BackAction); ui.openTeam(fixture.getString("teamId"))
                    ui.waitFor(hasText("Message après nouvel accord QA"))
                    ui.absent("Message nouvelle équipe QA", "Réponse seconde équipe QA", "Bonjour équipe QA", "Message après second enfant QA")
                    assertEquals("", ui.inputText()); passed("return-to-original-team-does-not-merge-other-thread"); capture("isolated")
                }
            }
        }
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        File(directory, "team-access-device.json").writeText(JSONObject().put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("scope", "local-native-team-access-changes-with-sdk-peers-not-physical-or-push")
            .put("checks", checks).put("events", events).put("messages", messages)
            .put("screenshots", ui.hashes(listOf("initial", "remaining", "revoked", "renewed", "other", "isolated").map { "team-access-$it" })).toString(2))
    }
}
