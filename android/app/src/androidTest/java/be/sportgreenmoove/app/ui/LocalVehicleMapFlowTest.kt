package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import kotlin.math.hypot

class LocalVehicleMapFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    @Test fun parentSeesActualVehicleMarkerMoveAfterAuthenticatedDriverPoints() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val args = InstrumentationRegistry.getArguments()
        assumeTrue(args.getString("vehicleMapApproved") != null)
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && BuildConfig.SGM_LOCAL_REAL_MAPS_UI)
        val context = instrumentation.targetContext
        check(context.getString(R.string.sgm_google_maps_android_api_key).isNotBlank())
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(args.getString("vehicleMapApproved") == session.getString("runId"))
        val rideId = requireNotNull(args.getString("liveRideId"))
        val device = UiDevice.getInstance(instrumentation); device.setOrientationNatural()
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val runtime = AndroidRuntime.create(context); runtime.auth.signOut()
        val displays = JSONArray(); val points = JSONArray()
        var movement = 0.0
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
          var phase = "login"
          try {
            waitFor(SgmTestTags.AuthEmailInput)
            AuthTestInteractions(compose, activity).use { it.signIn(session.getString("parent"), session.getString("password")) }
            waitFor(SgmTestTags.HomeScreen)
            phase = "open-ride"
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick(); waitFor(SgmTestTags.ActiveRideResumeAction)
            compose.onNodeWithTag(SgmTestTags.ActiveRideResumeAction).performScrollTo().performClick()
            waitFor(SgmTestTags.ActiveRideVehicleUpdate)
            runBlocking { LocalRideObservationPeer.open(context, session, rideId) }.use { peer ->
                var firstX = 0; var firstY = 0
                for ((index, coordinates) in listOf(50.75 to 4.55, 50.815 to 4.42).withIndex()) {
                    phase = if (index == 0) "first-point" else "moved-point"
                    val (lat, lng) = coordinates
                    runBlocking { peer.point(lat, lng) }
                    val ride = requireNotNull(runBlocking { runtime.firebase.getActiveRide() })
                    assertEquals(rideId, ride.rideSessionId)
                    val point = requireNotNull(ride.vehiclePoint)
                    assertEquals(lat, point.lat, 0.0); assertEquals(lng, point.lng, 0.0)
                    assertFalse(ride.stale)
                    points.put(JSONObject().put("lat", lat).put("lng", lng).put("capturedAt", point.capturedAt))
                    compose.onNodeWithTag(SgmTestTags.GoogleMapsRoutePreview).performScrollTo().assertIsDisplayed()
                    compose.waitUntil(60_000) {
                        val loaded = compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Carte chargée"),
                            useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
                        val marker = vehicleMarkerBounds(device)
                        loaded && marker != null && (index == 0 || hypot((marker.centerX() - firstX).toDouble(),
                            (marker.centerY() - firstY).toDouble()) >= 24.0)
                    }
                    val marker = requireNotNull(vehicleMarkerBounds(device))
                    if (index == 0) { firstX = marker.centerX(); firstY = marker.centerY() }
                    else movement = hypot((marker.centerX() - firstX).toDouble(), (marker.centerY() - firstY).toDouble())
                    displays.put(captureVehicleMarkerDisplay(compose, device, if (index == 0) "first" else "moved"))
                }
                assertEquals(mapOf("writeLocationBatch" to 2), peer.operations)
                assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
            }
            phase = "sign-out"
            compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick(); waitFor(SgmTestTags.AuthEmailInput)
            assertNull(FirebaseAuth.getInstance().currentUser)
          } catch (failure: Throwable) {
              try { captureVehicleMapFailure(phase) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
              throw failure
          }
        }
        runBlocking { FirebaseFirestore.getInstance().terminate().await() }
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        File(directory, "local-vehicle-map-device.json").writeText(JSONObject()
            .put("scope", "local-authenticated-vehicle-marker-real-map-not-physical-gps")
            .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId")).put("rideSessionId", rideId)
            .put("parentUid", "sgm-qa-parent").put("driverUid", "sgm-qa-driver").put("points", points)
            .put("displays", displays).put("markerMovementPixels", movement).put("sdkLoaded", true)
            .put("parentSignedOut", true).put("firestoreClientTerminated", true).put("physicalDevice", false)
            .put("providerTrackingVerified", false).put("childPositionsVerified", false).put("etaVerified", false).toString(2))
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) {
        compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
    }
}
