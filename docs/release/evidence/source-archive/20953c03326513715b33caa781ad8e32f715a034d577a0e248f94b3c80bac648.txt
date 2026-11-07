package be.sportgreenmoove.app.ui

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.provider.Settings
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.TripCancellationReady
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

@SdkSuppress(minSdkVersion = 29)
class LocalTripCancellationFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var session: JSONObject

    @Test fun driverCancelsAndParentSeesClosedReservationsAndPendingRefund() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val args = InstrumentationRegistry.getArguments()
        val tripId = requireNotNull(args.getString("cancellationTripId"))
        val paidId = requireNotNull(args.getString("cancellationPaidId"))
        val pendingId = requireNotNull(args.getString("cancellationPendingId"))
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        val device = UiDevice.getInstance(instrumentation)
        val autoRotation = Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0)
        try {
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                login("driver")
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } })
                openCancellation(tripId)
                screenshot(device, "local-trip-cancel-review-portrait.png")
                compose.onNodeWithTag("trip.cancel.keep").performClick()
                assertTrue(runBlocking { runtime.firebase.previewTripCancellation(tripId) } is TripCancellationReady)
                var originalOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                activity.onActivity { originalOrientation = it.requestedOrientation; it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
                try {
                    compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE && device.displayWidth > device.displayHeight }
                    waitFor(SgmTestTags.BottomNavTripsAction)
                    compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                    openCancellation(tripId)
                    compose.onNodeWithTag("trip.cancel.confirm").assertIsNotEnabled()
                    enterCancellationReason(compose, "Match reporté après contrôle local")
                    compose.onNodeWithTag("trip.cancel.confirm").assertIsDisplayed().assertIsEnabled()
                    screenshot(device, "local-trip-cancel-review-landscape.png")
                    compose.onNodeWithTag("trip.cancel.confirm").performClick()
                    waitFor("trip.cancel.recorded")
                    compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag("trip.cancel.keep").assertIsEnabled() }.isSuccess }
                    compose.onNodeWithTag("trip.cancel.error").assertDoesNotExist()
                    compose.onNodeWithTag("trip.cancel.title").assertTextEquals("Trajet annulé")
                    compose.onNodeWithTag("trip.cancel.refunds").performScrollTo().assertIsDisplayed()
                    screenshot(device, "local-trip-cancel-confirmed-landscape.png")
                    compose.onNodeWithTag("trip.cancel.confirm").assertDoesNotExist()
                    compose.onNodeWithTag("trip.cancel.keep").performClick()
                } finally { activity.onActivity { it.requestedOrientation = originalOrientation } }
                device.setOrientationNatural()
                compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT && device.displayWidth < device.displayHeight }
                waitFor(SgmTestTags.BottomNavTripsAction)
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).assertIsDisplayed().performClick()
                compose.onNodeWithText("PASSÉS").performClick()
                try { waitFor("trip.cancelled.$tripId") }
                catch (failure: Throwable) {
                    runCatching { captureLocalUi(compose, "local-trip-history-not-confirmed.png") }
                    runCatching {
                        val diagnostic = JSONObject().put("tripId", tripId)
                        try {
                            val saved = runBlocking { runtime.firebase.searchTrips().singleOrNull { it.id == tripId } }
                            diagnostic.put("query", "completed").put("found", saved != null)
                                .put("cancelled", saved?.cancelled).put("status", saved?.status?.name)
                        } catch (_: Exception) { diagnostic.put("query", "failed") }
                        File(context.getExternalFilesDir(null), "local-ui-evidence/local-trip-history-diagnostic.json").writeText(diagnostic.toString(2))
                    }
                    throw failure
                }
                compose.onNodeWithTag("trip.cancelled.$tripId").performScrollTo().assertTextEquals("Annulé")
                compose.onNodeWithTag("trip.cancel.$tripId").assertDoesNotExist()
                captureLocalUi(compose, "local-trip-cancelled-history.png")
                logout()
                login("parent")
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                compose.onNodeWithText("RÉSERVATIONS").performClick()
                for (id in listOf(paidId, pendingId)) {
                    waitFor("reservation.status.$id")
                    compose.onNodeWithTag("reservation.status.$id").performScrollTo().assertTextEquals("Annulée")
                    compose.onNodeWithTag(decisionTag(ReservationDecision.Cancel, id)).assertDoesNotExist()
                }
                compose.onNodeWithText("Remboursement en attente").performScrollTo().assertIsDisplayed()
                captureLocalUi(compose, "local-trip-cancelled-parent.png")
                val note = runBlocking { runtime.firebase.getInbox() }.notifications.single {
                    it.title == "Trajet annulé" && it.body == "Match reporté après contrôle local"
                }
                assertEquals("Trajet annulé", note.title)
                assertEquals("Match reporté après contrôle local", note.body)
            }
        } finally {
            device.setOrientationNatural()
            compose.waitUntil(15_000) { context.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT && device.displayWidth < device.displayHeight }
            instrumentation.waitForIdleSync()
            if (autoRotation != 0) device.unfreezeRotation()
        }
    }

    private fun openCancellation(tripId: String) {
        waitFor("trip.cancel.$tripId")
        compose.onNodeWithTag("trip.cancel.$tripId").performScrollTo().assertIsDisplayed().performClick()
        waitFor("trip.cancel.reason")
        compose.onNodeWithTag("trip.cancel.count").assertTextEquals("2 réservations concernées.")
        compose.onNodeWithTag("trip.cancel.refunds").assertExists()
    }
    private fun screenshot(device: UiDevice, name: String) {
        compose.waitForIdle()
        val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
        check(directory.isDirectory || directory.mkdirs())
        check(device.takeScreenshot(File(directory, name)))
    }
    private fun login(actor: String) {
        waitFor(SgmTestTags.AuthEmailAction)
        compose.onNodeWithTag(SgmTestTags.AuthEmailInput).performScrollTo().performTextInput(session.getString(actor))
        compose.onNodeWithTag(SgmTestTags.AuthPasswordInput).performScrollTo().performTextInput(session.getString("password"))
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).performScrollTo().performClick()
        waitFor(SgmTestTags.HomeScreen)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailAction)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
