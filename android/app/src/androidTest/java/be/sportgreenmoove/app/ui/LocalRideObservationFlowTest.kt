package be.sportgreenmoove.app.ui

import android.content.Context
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.SystemClock
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
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
import java.security.MessageDigest

class LocalRideObservationFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun parentReceivesLiveChangesAndClockAgingWithoutLeavingTheRide() {
        assumeTrue(BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val args = InstrumentationRegistry.getArguments()
        val rideId = requireNotNull(args.getString("liveRideId"))
        val bookingId = requireNotNull(args.getString("liveRideBookingId"))
        val childId = requireNotNull(args.getString("liveRideChildId"))
        val runtime = AndroidRuntime.create(context); runtime.auth.signOut()
        context.getSharedPreferences("appearance", Context.MODE_PRIVATE).edit().putBoolean("darkTheme", false).commit()
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        val captures = JSONObject()
        fun capture(name: String, tag: String = SgmTestTags.ActiveRideScreen, landscape: Boolean = false) {
            compose.onNodeWithTag(tag).assertIsDisplayed()
            val file = "local-ride-observation-$name.png"; captureLocalUi(compose, file, landscape)
            captures.put(file, MessageDigest.getInstance("SHA-256").digest(File(directory, file).readBytes()).joinToString("") { "%02x".format(it) })
        }
        var waited = 0L
        var operations: Map<String, Int>? = null
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            waitFor(SgmTestTags.AuthEmailAction)
            compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performTextInput(session.getString("parent"))
            compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performTextInput(session.getString("password"))
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
            waitFor(SgmTestTags.HomeScreen)
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick(); waitFor(SgmTestTags.ActiveRideResumeAction)
            compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
            waitFor(SgmTestTags.ActiveRideVehicleUpdate)
            val initialRide = runBlocking { runtime.firebase.getActiveRide() } ?: error("Expected the isolated active ride")
            assertEquals(rideId, initialRide.rideSessionId)
            compose.onNodeWithTag(SgmTestTags.ActiveRidePickupAction).assertDoesNotExist()
            compose.onNodeWithTag(SgmTestTags.ActiveRideEndAction).assertDoesNotExist()
            runBlocking { LocalRideObservationPeer.open(context, session, rideId) }.use { peer ->
                val start = SystemClock.elapsedRealtime()
                runBlocking { peer.point() }
                compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.ActiveRideStaleWarning).fetchSemanticsNodes().isEmpty() }
                capture("fresh")
                activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
                compose.waitUntil(60_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE }
                waitFor(SgmTestTags.ActiveRideVehicleUpdate); capture("fresh-landscape", landscape = true)
                activity.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
                compose.waitUntil(60_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT }
                waitFor(SgmTestTags.ActiveRideVehicleUpdate)
                compose.waitUntil(110_000) { compose.onAllNodesWithTag(SgmTestTags.ActiveRideStaleWarning).fetchSemanticsNodes().isNotEmpty() }
                waited = SystemClock.elapsedRealtime() - start
                assertTrue("Staleness must age in real elapsed time, not a fabricated clock", waited > 80_000)
                capture("stale")
                runBlocking { peer.point() }
                compose.waitUntil(60_000) { compose.onAllNodesWithTag(SgmTestTags.ActiveRideStaleWarning).fetchSemanticsNodes().isEmpty() }
                capture("recovered")
                runBlocking { peer.pickup(bookingId, childId) }; waitText("Prise en charge validée"); capture("pickup")
                activity.moveToState(Lifecycle.State.CREATED); assertEquals(Lifecycle.State.CREATED, activity.state)
                runBlocking { peer.dropoff(bookingId, childId) }
                activity.moveToState(Lifecycle.State.RESUMED)
                waitText("Dépose validée"); capture("resumed")
                runBlocking { peer.complete() }; waitText("AUCUNE COURSE ACTIVE"); capture("ended")
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                compose.onNodeWithText("PASSÉS").performClick()
                compose.waitUntil(60_000) { runBlocking { runtime.firebase.searchTrips() }.any { it.id == initialRide.tripId && it.status == be.sportgreenmoove.app.data.TripStatus.Past } }
                val trip = runBlocking { runtime.firebase.searchTrips() }.single { it.id == initialRide.tripId }
                selectLocalTripMonth(compose, trip); waitText("Trajet suivi continu QA")
                compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).assertDoesNotExist()
                capture("history", SgmTestTags.TripsScreen)
                assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
                assertEquals("sgm-qa-driver", peer.uid)
                operations = peer.operations.toMap()
            }
            compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick(); waitFor(SgmTestTags.AuthEmailAction)
            assertNull(FirebaseAuth.getInstance().currentUser)
        }
        File(directory, "local-ride-observation-device.json").writeText(JSONObject()
            .put("scope", "local-ride-live-sdk-not-physical-gps").put("projectId", "demo-sgm-local-qa")
            .put("runId", session.getString("runId")).put("rideSessionId", rideId).put("bookingId", bookingId).put("childId", childId)
            .put("parentUid", "sgm-qa-parent").put("driverUid", "sgm-qa-driver").put("staleWaitElapsedMs", waited)
            .put("operations", JSONObject(requireNotNull(operations))).put("screenshots", captures).put("parentSignedOut", true)
            .put("physicalDevice", false).put("providerTrackingVerified", false).put("mapMovementVerified", false).toString(2))
    }
    private fun waitFor(tag: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
        if (tag == SgmTestTags.ActiveRideVehicleUpdate) compose.onNodeWithTag(tag).performScrollTo()
        compose.onNodeWithTag(tag).assertIsDisplayed()
    }
    private fun waitText(text: String) {
        compose.waitUntil(60_000) { compose.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty() }
    }
}
