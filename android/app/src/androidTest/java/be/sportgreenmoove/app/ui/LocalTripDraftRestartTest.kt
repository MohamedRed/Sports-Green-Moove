package be.sportgreenmoove.app.ui

import android.os.Process
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import be.sportgreenmoove.app.services.SharedPreferencesTripChangeDrafts
import be.sportgreenmoove.app.services.TripChangeDraftCodec
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class LocalTripDraftRestartTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var session: JSONObject
    private lateinit var tripId: String
    private lateinit var otherTripId: String
    private val uid = "sgm-qa-driver"
    private val origin = "Rue du brouillon non choisi"
    private val destination = "Club du brouillon non choisi"

    @Test fun prepareUnfinishedTripDraft() = stage("before") { result ->
        AndroidRuntime.create(context).auth.signOut()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            waitFor(SgmTestTags.AuthEmailInput)
            AuthTestInteractions(compose, activity).use { it.signIn(session.getString("driver"), session.getString("password")) }
            assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
            open(tripId)
            enterTripFormText(compose, "trip.change.price", "4,")
            enterTripFormText(compose, "trip.change.origin.input", origin)
            enterTripFormText(compose, "trip.change.destination.input", destination)
            assertDraft()
            val hash = draftHash()
            closeEditor()
            open(otherTripId)
            assertEmptyEditor()
            closeEditor()
            open(tripId)
            assertDraft(); assertEquals(hash, draftHash())
            captureLocalUi(compose, "local-trip-draft-before.png", dialog = true)
            result.put("draftHash", hash).put("unfinishedFieldsSaved", true).put("otherTripIsolated", true)
        }
    }

    @Test fun recoverUnfinishedTripDraftInNewProcess() = stage("after") { result ->
        val before = JSONObject(File(directory(), "local-trip-draft-before.json").readText())
        check(before.getBoolean("completed") && before.getString("runId") == session.getString("runId"))
        assertEquals(tripId, before.getString("tripId"))
        assertNotEquals(before.getInt("processId"), Process.myPid())
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor(SgmTestTags.HomeScreen)
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
            assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
            open(tripId)
            assertDraft(); assertEquals(before.getString("draftHash"), draftHash())
            captureLocalUi(compose, "local-trip-draft-restored.png", dialog = true)
            closeEditor()
            open(otherTripId); assertEmptyEditor(); closeEditor()
            open(tripId); assertDraft()
            result.put("draftHash", draftHash()).put("sessionRestoredWithoutLogin", true)
                .put("unfinishedFieldsRestored", true).put("otherTripIsolated", true).put("submissionDisabled", true)
        }
    }

    private fun open(id: String) {
        val trip = runBlocking { AndroidRuntime.create(context).firebase.searchTrips().single { it.id == id } }
        assertEquals(uid, trip.driverUserId); assertNull(trip.pendingChangeId)
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        selectLocalTripMonth(compose, trip)
        waitFor("trip.edit.$id")
        compose.onNodeWithTag("trip.edit.$id").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.price")
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
        for (tag in listOf("error", "draft.error", "draft.conflict", "status")) compose.onNodeWithTag("trip.change.$tag").assertDoesNotExist()
    }
    private fun assertDraft() {
        compose.onNodeWithTag("trip.change.price").performScrollTo().assertTextContains("4,")
        compose.onNodeWithTag("trip.change.origin.input").performScrollTo().assertTextContains(origin)
        compose.onNodeWithTag("trip.change.destination.input").performScrollTo().assertTextContains(destination)
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        val record = requireNotNull(SharedPreferencesTripChangeDrafts(context).read(uid, tripId))
        assertEquals("4,", record.input.price); assertEquals(origin, record.input.origin.input)
        assertEquals(destination, record.input.destination.input)
        assertNull(record.input.origin.point); assertNull(record.input.origin.address)
        assertNull(record.input.destination.point); assertNull(record.input.destination.address)
        assertNull(record.pendingProposal)
    }
    private fun assertEmptyEditor() {
        compose.onNodeWithTag("trip.change.price").performScrollTo().assertTextContains("2,50")
        compose.onNodeWithTag("trip.change.origin.input").performScrollTo().assert(!hasText(origin, substring = true))
        compose.onNodeWithTag("trip.change.destination.input").performScrollTo().assert(!hasText(destination, substring = true))
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        assertNull(SharedPreferencesTripChangeDrafts(context).read(uid, otherTripId))
    }
    private fun draftHash(): String {
        val record = requireNotNull(SharedPreferencesTripChangeDrafts(context).read(uid, tripId))
        return MessageDigest.getInstance("SHA-256").digest(TripChangeDraftCodec.encode(uid, tripId, record).toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
    private fun closeEditor() {
        compose.onNodeWithContentDescription("Fermer").assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
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
        tripId = requireNotNull(args.getString("draftRestartTripId"))
        otherTripId = requireNotNull(args.getString("draftRestartOtherTripId")); check(tripId != otherTripId)
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-ui-private-trip-draft-restart").put("stage", name).put("completed", false)
            .put("actorUserId", uid).put("tripId", tripId).put("otherTripId", otherTripId).put("processId", Process.myPid())
        try { action(result); write(name, result.put("completed", true)) }
        catch (failure: Throwable) {
            try { write(name, result.put("completed", false)) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
            throw failure
        }
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
    private fun write(name: String, value: JSONObject) = File(directory(), "local-trip-draft-$name.json").writeText(value.toString(2))
}
