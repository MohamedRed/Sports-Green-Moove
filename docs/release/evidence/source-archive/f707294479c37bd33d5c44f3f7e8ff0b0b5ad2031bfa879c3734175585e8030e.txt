package be.sportgreenmoove.app.ui

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.*
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.ActiveRideLocationService
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class LocalRemoteRideStopFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun completionFromASecondSessionStopsTheBackgroundServiceBeforeTheAppReturns() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        val args = InstrumentationRegistry.getArguments()
        val rideId = requireNotNull(args.getString("liveRideId"))
        val bookingId = requireNotNull(args.getString("liveBookingId")); val childId = requireNotNull(args.getString("liveChildId"))
        val runtime = AndroidRuntime.create(context); runtime.auth.signOut()
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence").apply { mkdirs() }
        val captures = JSONObject()
        fun capture(name: String, tag: String) {
            compose.onNodeWithTag(tag).assertIsDisplayed()
            val file = "local-native-startup-remote-$name.png"; captureNativeStartupWindow(compose, file)
            captures.put(file, MessageDigest.getInstance("SHA-256").digest(File(directory, file).readBytes()).joinToString("") { "%02x".format(it) })
        }
        try {
            LocalMockLocation(context).use { mock ->
                ActivityScenario.launch(MainActivity::class.java).use { activity ->
                    waitFor(SgmTestTags.AuthEmailAction)
                    compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performTextInput(session.getString("driver"))
                    compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performTextInput(session.getString("password"))
                    compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(SgmTestTags.HomeScreen)
                    compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick(); waitFor(SgmTestTags.ActiveRideResumeAction)
                    assertEquals(rideId, runBlocking { runtime.firebase.getActiveRide() }?.rideSessionId)
                    mock.withCaptureFeed(System.currentTimeMillis()) {
                        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
                        waitFor(SgmTestTags.ActiveRidePickupAction); compose.waitUntil(15_000) { serviceRunning(context) }
                        capture("started", SgmTestTags.ActiveRideScreen)
                        activity.onActivity { assertTrue("The task must move behind the launcher", it.moveTaskToBack(true)) }
                        compose.waitUntil(15_000) { activity.state == Lifecycle.State.CREATED }
                        assertTrue(serviceRunning(context))
                        runBlocking { LocalRideCompletionPeer.open(context, session).use { it.complete(rideId, bookingId, childId) } }
                        File(directory, "local-remote-ride-stop-checkpoint.json").writeText(JSONObject()
                            .put("runId", session.getString("runId")).put("rideSessionId", rideId).put("peerCompletionAcknowledged", true)
                            .put("appBackgrounded", activity.state == Lifecycle.State.CREATED)
                            .put("serviceRunningImmediatelyAfterCompletion", serviceRunning(context)).toString(2))
                        compose.waitUntil(20_000) { !serviceRunning(context) }
                        assertEquals(Lifecycle.State.CREATED, activity.state)
                        assertEquals("sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)
                    }
                    activity.onActivity { it.startActivity(Intent(it, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
                    compose.waitUntil(15_000) { activity.state == Lifecycle.State.RESUMED }
                    waitFor(SgmTestTags.ActiveRideScreen)
                    compose.waitUntil(60_000) { compose.onAllNodesWithText("AUCUNE COURSE ACTIVE").fetchSemanticsNodes().isNotEmpty() }
                    capture("ended", SgmTestTags.ActiveRideScreen)
                }
            }
        } finally {
            runtime.firebase.stopNativeLocationFallback(rideId); runtime.auth.signOut()
            runBlocking { FirebaseFirestore.getInstance().waitForPendingWrites().await(); FirebaseFirestore.getInstance().terminate().await() }
        }
        File(directory, "local-remote-ride-stop-device.json").writeText(JSONObject()
            .put("scope", "local-remote-completion-service-stop-not-physical-background-gps").put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("rideSessionId", rideId).put("bookingId", bookingId).put("childId", childId)
            .put("backgroundStopBeforeResume", true).put("driverStillSignedInAtStop", true).put("peerCompletionAcknowledged", true)
            .put("mockModeRestored", true).put("firestoreClientTerminated", true).put("screenshots", captures)
            .put("physicalDevice", false).put("providerTrackingVerified", false).put("physicalBackgroundGpsVerified", false).toString(2))
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        if (tag in setOf(SgmTestTags.ActiveRideResumeAction, SgmTestTags.ActiveRidePickupAction)) compose.onNodeWithTag(tag).performScrollTo()
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    @Suppress("DEPRECATION")
    private fun serviceRunning(context: Context) = (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
        .getRunningServices(50).any { it.service.className == ActiveRideLocationService::class.java.name }
}
