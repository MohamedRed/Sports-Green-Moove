package be.sportgreenmoove.app.ui

import android.app.ActivityManager
import android.content.Context
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.printToString
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.ActiveRideLocationService
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.nativeLocationPayload
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
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

class LocalNativeTrackingStartupTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun aRetainedPointStartsAndResumesTrackingButAnInvalidPointDoesNot() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        val rideId = requireNotNull(InstrumentationRegistry.getArguments().getString("liveRideId"))
        val runtime = AndroidRuntime.create(context); runtime.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        val captures = JSONObject(); val receipts = JSONObject()
        fun capture(name: String, tag: String) {
            compose.onNodeWithTag(tag).assertIsDisplayed()
            val file = "local-native-startup-$name.png"; captureNativeStartupWindow(compose, file)
            compose.onNodeWithTag(tag).assertIsDisplayed()
            captures.put(file, MessageDigest.getInstance("SHA-256").digest(File(directory, file).readBytes()).joinToString("") { "%02x".format(it) })
        }
        var capturedAt = 0L
        try {
            LocalMockLocation(context).use { mock ->
                fun step(time: Long, action: () -> Unit) = mock.withCaptureFeed(time) {
                    try { action() }
                    catch (error: Throwable) {
                        try {
                            captureNativeStartupWindow(compose, "local-native-startup-failure.png")
                            File(directory, "local-native-startup-failure-tree.txt").writeText(
                                compose.onRoot(useUnmergedTree = true).printToString().replace(session.getString("password"), "[REDACTED]"))
                        } catch (diagnostic: Throwable) { error.addSuppressed(diagnostic) }
                        throw error
                    }
                }
                ActivityScenario.launch(MainActivity::class.java).use {
                    waitFor(SgmTestTags.AuthEmailAction)
                    compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performTextInput(session.getString("driver"))
                    compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performTextInput(session.getString("password"))
                    compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick(); waitFor(SgmTestTags.HomeScreen)
                    compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick(); waitFor(SgmTestTags.ActiveRideResumeAction)
                    assertEquals(rideId, runBlocking { runtime.firebase.getActiveRide() }?.rideSessionId)
                    val location = mock.emit(); capturedAt = location.time
                    fun send(): Map<*, *> = runBlocking {
                        FirebaseFunctions.getInstance().getHttpsCallable("writeLocationBatch")
                            .call(mapOf("updates" to listOf(nativeLocationPayload(rideId, "driver", location)))).await().data as Map<*, *>
                    }
                    val first = send(); assertEquals(1, (first["written"] as Number).toInt())
                    val duplicate = send(); assertEquals(0, (duplicate["written"] as Number).toInt())
                    assertEquals("retained", ((duplicate["receipts"] as List<*>).single() as Map<*, *>)["status"])
                    receipts.put("first", JSONObject(first)); receipts.put("duplicate", JSONObject(duplicate))
                    step(capturedAt) {
                        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
                        waitFor(SgmTestTags.ActiveRidePickupAction); waitRunning(context, true)
                        capture("started", SgmTestTags.ActiveRideScreen)
                    }
                    runtime.firebase.stopNativeLocationFallback(rideId); waitRunning(context, false)
                    compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick(); waitFor(SgmTestTags.ActiveRideResumeAction)
                    step(System.currentTimeMillis() + 86_400_000) {
                        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
                        compose.waitUntil(60_000) { compose.onAllNodesWithText("Position GPS non confirmée. Réessayez.").fetchSemanticsNodes().isNotEmpty() }
                        compose.onNodeWithText("Position GPS non confirmée. Réessayez.").assertIsDisplayed()
                        assertFalse(serviceRunning(context)); capture("invalid", SgmTestTags.TripsScreen)
                    }
                    step(capturedAt) {
                        compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
                        waitFor(SgmTestTags.ActiveRidePickupAction); waitRunning(context, true)
                        assertEquals(rideId, runBlocking { runtime.firebase.getActiveRide() }?.rideSessionId)
                        compose.onNodeWithText("Position GPS non confirmée. Réessayez.").assertDoesNotExist()
                        capture("resumed", SgmTestTags.ActiveRideScreen)
                    }
                    compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
                    compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick(); waitFor(SgmTestTags.AuthEmailAction)
                    waitRunning(context, false); assertNull(FirebaseAuth.getInstance().currentUser)
                    capture("signed-out", SgmTestTags.AuthEmailAction)
                }
            }
        } finally {
            runtime.firebase.stopNativeLocationFallback(rideId); runtime.auth.signOut()
            runBlocking {
                FirebaseFirestore.getInstance().waitForPendingWrites().await()
                FirebaseFirestore.getInstance().terminate().await()
            }
        }
        File(directory, "local-native-startup-device.json").writeText(JSONObject()
            .put("scope", "local-fused-mock-startup-not-physical-gps").put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("rideSessionId", rideId).put("capturedAt", capturedAt)
            .put("driverUid", "sgm-qa-driver").put("receipts", receipts).put("screenshots", captures)
            .put("captureMethod", "render-enabled-decor-window-pixel-copy")
            .put("duplicateStarted", true).put("invalidPreventedStart", true).put("duplicateResumed", true)
            .put("serviceStoppedOnSignOut", true).put("mockModeRestored", true).put("driverSignedOut", true)
            .put("firestoreClientTerminated", true)
            .put("physicalDevice", false).put("providerTrackingVerified", false).put("mapMovementVerified", false).toString(2))
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        if (tag in setOf(SgmTestTags.ActiveRideResumeAction, SgmTestTags.ActiveRidePickupAction)) compose.onNodeWithTag(tag).performScrollTo()
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    private fun waitRunning(context: Context, expected: Boolean) { compose.waitUntil(15_000) { serviceRunning(context) == expected } }
    @Suppress("DEPRECATION")
    private fun serviceRunning(context: Context) = (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
        .getRunningServices(50).any { it.service.className == ActiveRideLocationService::class.java.name }
}
