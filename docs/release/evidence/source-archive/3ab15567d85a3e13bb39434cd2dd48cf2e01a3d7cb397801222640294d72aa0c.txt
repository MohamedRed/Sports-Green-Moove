package be.sportgreenmoove.app.ui

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.test.core.app.ActivityScenario
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONObject
import java.io.File

internal fun <A : Activity> ActivityScenario<A>.useWithFailureObservation(
    observe: (ActivityScenario<A>) -> Unit, block: (ActivityScenario<A>) -> Unit,
) {
    use { activity ->
        try { block(activity) }
        catch (failure: Throwable) {
            try { observe(activity) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
            throw failure
        }
    }
}

internal fun captureSessionFailureBeforeClose(context: Context, device: UiDevice, session: JSONObject,
    compose: ComposeTestRule, phase: String, activityState: String) {
    check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
    check(context.packageName == "be.sportgreenmoove.app.local")
    check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
    check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
    check(session.getString("runId").matches(Regex("[a-f0-9]{32}")))
    check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
    check(phase in setOf("launching-app", "initial-error", "rotated-error", "retry", "recovered", "restored", "identity"))
    val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
    val file = File(directory, "session-failure-before-close.json")
    check(!file.exists())
    val screenshot = File(directory, "local-session-restoration-failure-before-close.png")
    check(!screenshot.exists())
    val report = JSONObject().put("scope", "read-only-session-ui-before-activity-close-not-repair")
        .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
        .put("phase", phase).put("elapsedRealtimeMs", SystemClock.elapsedRealtime())
        .put("activityState", activityState).put("parentStillAuthenticated", FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent")
        .put("screenshotSaved", device.takeScreenshot(screenshot)).put("networkSettingsChanged", false)
        .put("authenticationRetried", false).put("deadlinesChanged", false).put("repairAccepted", false)
    file.writeText(report.toString(2))
    val nodes = JSONObject()
    for ((name, tag) in listOf("loading" to "session.restore.loading", "error" to "session.restore.error",
        "home" to SgmTestTags.HomeScreen, "signIn" to SgmTestTags.AuthEmailAction)) {
        nodes.put(name, compose.onAllNodesWithTag(tag).fetchSemanticsNodes().size)
        report.put("nodeCounts", nodes)
        file.writeText(report.toString(2))
    }
}
