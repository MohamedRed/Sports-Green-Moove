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
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalTeamDraftRestartTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val body = "Brouillon équipe après fermeture QA"
    private val scope = "local-team-draft-process-restart-not-physical-or-push"

    @Test fun preparePrivateTeamDraft(): Unit = with(LocalTeamChatUi(compose)) {
        val (context, session) = fixture()
        AndroidRuntime.create(context).auth.signOut()
        ActivityScenario.launch(MainActivity::class.java).use {
            login(session, "parent"); open(session.getJSONObject("teamChat"))
            compose.onNodeWithTag(SgmTestTags.ChatMessageInput).performTextInput(body)
            assertEquals(body, inputText()); capture("team-draft-before")
            checkpoint(context, session, "local-team-draft-before.json", "draft-prepared")
        }
    }

    @Test fun recoverAndSendPrivateDraftInNewProcess(): Unit = with(LocalTeamChatUi(compose)) {
        val (context, session) = fixture()
        val before = previous(context, session, "local-team-draft-before.json", "draft-prepared")
        AndroidRuntime.create(context)
        assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
        var messageId = ""
        runBlocking { LocalTeamChatPeer.open(context, session, "driver") }.use { driver ->
            ActivityScenario.launch(MainActivity::class.java).use {
                waitFor(hasTestTag(SgmTestTags.HomeScreen)); open(session.getJSONObject("teamChat"))
                capture("team-draft-reopened")
                assertEquals("The private unsent team draft must survive a fully stopped process", body, inputText())
                // The restored text is already present: one physical send tap must not type it twice.
                sendRestoredNativeTeamMessage(compose, body)
                messageId = runBlocking { driver.observeParentMessage(body) }
                assertEquals("", inputText()); capture("team-draft-sent")
                checkpoint(context, session, "local-team-draft-sent-before.json", "draft-sent")
                    .put("firstProcessId", before.getInt("processId")).put("messageId", messageId).also {
                        File(directory(context), "local-team-draft-sent-before.json").writeText(it.toString(2))
                    }
            }
        }
    }

    @Test fun acknowledgedDraftStaysEmptyInThirdProcess(): Unit = with(LocalTeamChatUi(compose)) {
        val (context, session) = fixture()
        val sent = previous(context, session, "local-team-draft-sent-before.json", "draft-sent")
        assertNotEquals(sent.getInt("firstProcessId"), Process.myPid())
        val providers = AndroidRuntime.create(context)
        assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor(hasTestTag(SgmTestTags.HomeScreen)); open(session.getJSONObject("teamChat"))
            assertEquals("", inputText()); waitFor(hasText(body)); capture("team-draft-cleared")
            click(SgmTestTags.BottomNavProfileAction)
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login(session, "driver"); open(session.getJSONObject("teamChat"))
            assertEquals("", inputText()); capture("team-draft-other-account")
        }
        providers.auth.signOut()
        File(directory(context), "team-draft-device.json").writeText(JSONObject()
            .put("scope", scope).put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("firstProcessId", sent.getInt("firstProcessId")).put("secondProcessId", sent.getInt("processId"))
            .put("processId", Process.myPid()).put("messageId", sent.getString("messageId"))
            .put("draftRestored", true).put("explicitSendIndependentlyRead", true).put("acknowledgedDraftCleared", true)
            .put("otherAccountDraftEmpty", true).put("parentSignedOut", true).put("completed", true)
            .put("screenshots", hashes(listOf("team-draft-before", "team-draft-reopened", "team-draft-sent",
                "team-draft-cleared", "team-draft-other-account"))).toString(2))
    }

    private fun fixture(): Pair<Context, JSONObject> {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        return context to session
    }
    private fun checkpoint(context: Context, session: JSONObject, name: String, phase: String): JSONObject =
        JSONObject().put("scope", scope + "-checkpoint").put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("processId", Process.myPid()).put("phase", phase)
            .put("teamInstanceId", session.getJSONObject("teamChat").getString("teamInstanceId"))
            .also { File(directory(context), name).writeText(it.toString(2)) }

    private fun previous(context: Context, session: JSONObject, name: String, phase: String): JSONObject {
        val before = JSONObject(File(directory(context), name).readText())
        check(before.getString("scope") == scope + "-checkpoint" && before.getString("phase") == phase)
        check(before.getString("runId") == session.getString("runId") && before.getString("projectId") == "demo-sgm-local-qa")
        assertEquals(session.getJSONObject("teamChat").getString("teamInstanceId"), before.getString("teamInstanceId"))
        assertNotEquals(before.getInt("processId"), Process.myPid()); return before
    }
    private fun directory(context: Context) = File(context.getExternalFilesDir(null), "local-ui-evidence")
        .also { check(it.isDirectory || it.mkdirs()) }
}
