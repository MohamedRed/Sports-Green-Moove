package be.sportgreenmoove.app.ui

import android.os.Process
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

@SdkSuppress(minSdkVersion = 29)
class LocalTripConsentRestartTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var session: JSONObject
    private lateinit var activity: ActivityScenario<MainActivity>
    private lateinit var tripId: String
    private lateinit var bookingId: String

    @Test fun prepareConfirmedConsent() = stage("before") { result ->
        AndroidRuntime.create(context).auth.signOut()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            login("driver", "sgm-qa-driver")
            openDriverTrip(expectedProposalId = null)
            waitFor("trip.change.price")
            enterTripFormText(compose, "trip.change.price", "4.00")
            compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Accords des parents en attente")
            closeDialog()
            logout()
            login("parent", "sgm-qa-parent")
            openParentReview()
            assertPrices()
            compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsEnabled().performClick()
            assertParentConsent()
            result.put("proposalId", currentProposalId()).put("parentConfirmed", true).put("notApplied", true)
            compose.onNodeWithTag("trip.change.original").performScrollTo()
            captureLocalUi(compose, "local-trip-consent-restart-before.png", dialog = true)
        }
    }

    @Test fun reopenConfirmedConsent() = stage("after") { result ->
        val before = JSONObject(File(directory(), "local-trip-consent-restart-before.json").readText())
        check(before.getString("runId") == session.getString("runId") && before.getBoolean("completed"))
        check(before.getString("tripId") == tripId && before.getString("bookingId") == bookingId)
        assertNotEquals("A new app process is required", before.getInt("processId"), Process.myPid())
        val proposalId = before.getString("proposalId")
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            waitFor(SgmTestTags.HomeScreen)
            assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
            result.put("sessionRestoredWithoutLogin", true)
            openParentReview()
            assertParentConsent()
            assertPrices()
            assertEquals(proposalId, currentProposalId())
            result.put("originalProposalRestored", true).put("parentDecisionRestored", true)
                .put("duplicateDecisionActionsAbsent", true)
            refreshReview()
            refreshReview()
            assertParentConsent()
            result.put("explicitRefreshRestored", true)
            compose.onNodeWithTag("trip.change.original").performScrollTo()
            captureLocalUi(compose, "local-trip-consent-restart-after.png", dialog = true)
            closeDialog()
            logout()
            login("driver", "sgm-qa-driver")
            openDriverTrip(expectedProposalId = proposalId)
            expectStatus("Tous les parents ont confirmé")
            idleReview()
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 1")
            compose.onNodeWithTag("trip.change.accept").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            assertPrices()
            assertEquals(proposalId, currentProposalId())
            compose.onNodeWithText("Les détails proposés ne sont pas encore appliqués.").performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag("trip.change.calculate").performScrollTo().assertIsEnabled()
            result.put("driverSawSameConsent", true).put("notApplied", true)
                .put("proposalId", proposalId).put("endedAsUserId", FirebaseAuth.getInstance().currentUser?.uid)
            compose.onNodeWithTag("trip.change.original").performScrollTo()
            captureLocalUi(compose, "local-trip-consent-restart-driver.png", dialog = true)
        }
    }

    private fun stage(name: String, action: (JSONObject) -> Unit) {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        AndroidRuntime.create(context)
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val args = InstrumentationRegistry.getArguments()
        tripId = requireNotNull(args.getString("consentRestartTripId"))
        bookingId = requireNotNull(args.getString("consentRestartBookingId"))
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-ui-confirmed-trip-consent-restart-stage").put("stage", name)
            .put("tripId", tripId).put("bookingId", bookingId).put("actorUserId", "sgm-qa-parent")
            .put("processId", Process.myPid()).put("completed", false)
        try {
            action(result)
            result.put("completed", true)
            write(name, result)
        } catch (failure: Throwable) {
            try { write(name, result.put("completed", false)) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
            throw failure
        }
    }

    private fun login(key: String, uid: String) {
        waitFor(SgmTestTags.AuthEmailInput)
        AuthTestInteractions(compose, activity).use { it.signIn(session.getString(key), session.getString("password")) }
        assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailInput)
    }
    private fun openDriverTrip(expectedProposalId: String?) {
        val trip = runBlocking { AndroidRuntime.create(context).firebase.searchTrips().single { it.id == tripId } }
        assertEquals("The driver must reopen the expected proposal", expectedProposalId, trip.pendingChangeId)
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        selectLocalTripMonth(compose, trip)
        val action = if (expectedProposalId == null) "edit" else "review"
        val unavailableAction = if (expectedProposalId == null) "review" else "edit"
        waitFor("trip.$action.$tripId")
        compose.onNodeWithTag("trip.$unavailableAction.$tripId").assertDoesNotExist()
        compose.onNodeWithTag("trip.$action.$tripId").performScrollTo().assertIsEnabled().performClick()
    }
    private fun openParentReview() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithText("RÉSERVATIONS").performClick()
        waitFor("reservation.change.$bookingId")
        compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag("reservation.change.$bookingId").assertIsEnabled() }.isSuccess }
        compose.onNodeWithTag("bookings.error").assertDoesNotExist()
        compose.onNodeWithTag("reservation.change.$bookingId").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.status")
        idleReview()
    }
    private fun assertPrices() {
        compose.onNodeWithTag("trip.change.original").performScrollTo().assert(hasAnyDescendant(hasText("2,50 EUR / place")))
        compose.onNodeWithTag("trip.change.proposed").performScrollTo().assert(hasAnyDescendant(hasText("4,00 EUR / place")))
    }
    private fun assertParentConsent() {
        expectStatus("Tous les parents ont confirmé")
        idleReview()
        compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 1")
        compose.onNodeWithTag("trip.change.decision").assertTextEquals("Votre accord est enregistré.")
        for (tag in listOf("trip.change.accept", "trip.change.decline", "trip.change.apply")) compose.onNodeWithTag(tag).assertDoesNotExist()
    }
    private fun refreshReview() {
        compose.onNodeWithTag("trip.change.refresh").performScrollTo().assertIsEnabled().performClick()
        compose.waitForIdle()
        idleReview()
        compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
    }
    private fun currentProposalId() = runBlocking {
        requireNotNull(AndroidRuntime.create(context).firebase.searchTrips().single { it.id == tripId }.pendingChangeId)
    }
    private fun idleReview() = compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
    private fun expectStatus(value: String) = compose.waitUntil(60_000) {
        runCatching { compose.onNodeWithTag("trip.change.status").assertTextEquals(value) }.isSuccess
    }
    private fun closeDialog() {
        idleReview()
        compose.onNodeWithTag("trip.change.close").assertIsDisplayed().assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
    private fun write(name: String, result: JSONObject) = File(directory(), "local-trip-consent-restart-$name.json").writeText(result.toString(2))
}
