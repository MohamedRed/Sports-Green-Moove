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
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class LocalNotificationReadFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private lateinit var context: Context
    private lateinit var session: JSONObject
    private lateinit var selectedId: String
    private lateinit var controlId: String
    private lateinit var driverId: String

    @Test fun readSelectedNotificationAndSwitchAccounts() {
        stage("before") { result ->
            AndroidRuntime.create(context).auth.signOut()
            ActivityScenario.launch(MainActivity::class.java).use {
                login("parent"); openNotifications()
                assertState(controlId, "Non lue"); assertState(selectedId, "Non lue")
                captureLocalUi(compose, "local-notification-read-unread.png")
                compose.onNodeWithTag("notification.read.$selectedId").performClick()
                compose.waitUntil(60_000) { runCatching {
                    compose.onNodeWithTag("notification.status.$selectedId").assertTextContains(" · Lue", substring = true)
                }.isSuccess }
                compose.onNodeWithTag("notification.read.$selectedId").assertDoesNotExist()
                result.put("selectedReadConfirmed", true)
                assertState(controlId, "Non lue"); result.put("controlRemainedUnread", true)
                assertState(selectedId, "Lue")
                captureLocalUi(compose, "local-notification-read-confirmed.png")
                logout(); login("driver"); openNotifications()
                assertState(driverId, "Non lue")
                compose.onNodeWithTag("notification.$selectedId").assertDoesNotExist()
                compose.onNodeWithTag("notification.$controlId").assertDoesNotExist()
                result.put("driverAccountIsolated", true)
                captureLocalUi(compose, "local-notification-read-driver.png")
                logout(); login("parent"); openNotifications(); assertState(selectedId, "Lue")
                result.put("parentReturnedRead", true)
                captureLocalUi(compose, "local-notification-read-parent-return.png")
            }
        }
    }

    @Test fun reopenReadNotificationAfterProcessDeath() {
        stage("after") { result ->
            val before = JSONObject(File(directory(), "local-notification-read-before.json").readText())
            check(before.getString("runId") == session.getString("runId") && before.getBoolean("completed"))
            assertNotEquals(before.getInt("processId"), Process.myPid())
            ActivityScenario.launch(MainActivity::class.java).use {
                waitFor(SgmTestTags.HomeScreen)
                assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
                result.put("sessionRestoredWithoutLogin", true)
                openNotifications(); assertState(controlId, "Non lue"); result.put("controlRemainedUnread", true)
                assertState(selectedId, "Lue"); result.put("selectedReadRestored", true)
                compose.onNodeWithTag("notification.read.$selectedId").assertDoesNotExist()
                result.put("readActionAbsent", true)
                captureLocalUi(compose, "local-notification-read-restarted.png")
            }
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
        val args = InstrumentationRegistry.getArguments()
        selectedId = requireNotNull(args.getString("selectedNoticeId"))
        controlId = requireNotNull(args.getString("controlNoticeId"))
        driverId = requireNotNull(args.getString("driverNoticeId"))
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-notification-read-process-stage").put("stage", name).put("completed", false)
            .put("processId", Process.myPid()).put("actorUserId", "sgm-qa-parent")
            .put("selectedNoticeId", selectedId).put("controlNoticeId", controlId).put("driverNoticeId", driverId)
        try { action(result); result.put("completed", true) }
        finally { File(directory(), "local-notification-read-$name.json").writeText(result.toString(2)) }
    }

    private fun openNotifications() {
        waitFor(SgmTestTags.BottomNavMessagesAction)
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
        compose.onNodeWithText("NOTIFS").performClick()
        waitFor(SgmTestTags.ChatInboxList)
    }
    private fun assertState(id: String, status: String) {
        compose.waitUntil(60_000) { runCatching {
            compose.onNodeWithTag(SgmTestTags.ChatInboxList).performScrollToNode(hasTestTag("notification.$id"))
            compose.onNodeWithTag("notification.status.$id").assertTextContains(" · $status", substring = true)
        }.isSuccess }
        compose.onNodeWithTag("notification.$id").assertIsDisplayed()
    }
    private fun login(actor: String) {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextReplacement(session.getString(actor))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextReplacement(session.getString("password"))
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
        assertEquals(if (actor == "parent") "sgm-qa-parent" else "sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailAction)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
}
