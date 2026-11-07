package be.sportgreenmoove.app.ui

import android.os.Process
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.domain.BelgianTripZone
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
import java.time.Instant
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@SdkSuppress(minSdkVersion = 29)
class LocalTripScheduleDraftRestartTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val uid = "sgm-qa-driver"
    private lateinit var session: JSONObject
    private lateinit var tripId: String
    private lateinit var otherTripId: String
    private lateinit var original: ZonedDateTime
    private lateinit var departure: ZonedDateTime
    private lateinit var arrival: ZonedDateTime

    @Test fun prepareScheduleDraft() = stage("before") { result ->
        AndroidRuntime.create(context).auth.signOut()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            waitFor(SgmTestTags.AuthEmailInput)
            AuthTestInteractions(compose, activity).use { it.signIn(session.getString("driver"), session.getString("password")) }
            assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
            open(tripId)
            pickDate("departure", original.toLocalDate(), departure.toLocalDate())
            pickTime("departure", departure)
            compose.onNodeWithTag("trip.change.arrival.enabled").performScrollTo().assertIsOff().performClick()
            pickDate("arrival", original.toLocalDate(), arrival.toLocalDate())
            pickTime("arrival", arrival)
            assertSchedule()
            val hash = draftHash()
            closeEditor(); open(otherTripId); assertOtherTrip(); closeEditor()
            open(tripId); assertSchedule(); assertEquals(hash, draftHash())
            captureLocalUi(compose, "local-trip-schedule-draft-before.png", dialog = true)
            record(result).put("scheduleSaved", true)
        }
    }

    @Test fun recoverScheduleDraftInNewProcess() = stage("after") { result ->
        val before = JSONObject(File(directory(), "local-trip-schedule-draft-before.json").readText())
        check(before.getBoolean("completed") && before.getString("runId") == session.getString("runId"))
        assertEquals(tripId, before.getString("tripId")); assertNotEquals(before.getInt("processId"), Process.myPid())
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor(SgmTestTags.HomeScreen)
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
            assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
            open(tripId); assertSchedule(); assertEquals(before.getString("draftHash"), draftHash())
            closeEditor(); open(otherTripId); assertOtherTrip(); closeEditor()
            open(tripId); assertSchedule()
            captureLocalUi(compose, "local-trip-schedule-draft-restored.png", dialog = true)
            record(result).put("scheduleRestored", true).put("sessionRestoredWithoutLogin", true)
        }
    }

    private fun open(id: String) {
        val trip = runBlocking { AndroidRuntime.create(context).firebase.searchTrips().single { it.id == id } }
        assertEquals(uid, trip.driverUserId); assertNull(trip.pendingChangeId)
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        selectLocalTripMonth(compose, trip); waitFor("trip.edit.$id")
        compose.onNodeWithTag("trip.edit.$id").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.departure.date")
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
        for (tag in listOf("error", "draft.error", "draft.conflict", "status")) compose.onNodeWithTag("trip.change.$tag").assertDoesNotExist()
    }
    private fun assertSchedule() {
        assertDate("departure", departure.toLocalDate()); assertTime("departure", departure)
        compose.onNodeWithTag("trip.change.arrival.enabled").performScrollTo().assertIsOn()
        assertDate("arrival", arrival.toLocalDate()); assertTime("arrival", arrival)
        compose.onNodeWithTag("trip.change.price").performScrollTo().assertTextContains("2,50")
        compose.onNodeWithTag("trip.change.validation").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled()
        val record = requireNotNull(SharedPreferencesTripChangeDrafts(context).read(uid, tripId))
        assertEquals(original.toInstant(), Instant.parse(record.original.departureAt))
        assertEquals(departure.toLocalDate(), record.input.departureDate); assertEquals(departure.toLocalTime(), record.input.departureTime)
        assertEquals(arrival.toLocalDate(), record.input.arrivalDate); assertEquals(arrival.toLocalTime(), record.input.arrivalTime)
        assertTrue(record.input.hasArrival); assertEquals("2,50", record.input.price); assertNull(record.pendingProposal)
        assertEquals(record.original.origin, record.input.origin.point); assertEquals(record.original.destination, record.input.destination.point)
        assertEquals("", record.input.origin.input); assertEquals("", record.input.destination.input)
    }
    private fun assertOtherTrip() {
        assertDate("departure", original.toLocalDate()); assertTime("departure", original)
        compose.onNodeWithTag("trip.change.arrival.enabled").performScrollTo().assertIsOff()
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        assertNull(SharedPreferencesTripChangeDrafts(context).read(uid, otherTripId))
    }
    private fun record(result: JSONObject): JSONObject {
        val input = requireNotNull(SharedPreferencesTripChangeDrafts(context).read(uid, tripId)).input
        return result.put("draftHash", draftHash()).put("departureDate", input.departureDate.toString())
            .put("departureTime", input.departureTime.toString()).put("arrivalDate", input.arrivalDate.toString())
            .put("arrivalTime", input.arrivalTime.toString()).put("hasArrival", input.hasArrival)
            .put("originalPlacesRetained", true).put("otherTripIsolated", true).put("proposeEnabled", true)
    }
    private fun draftHash(): String {
        val record = requireNotNull(SharedPreferencesTripChangeDrafts(context).read(uid, tripId))
        return MessageDigest.getInstance("SHA-256").digest(TripChangeDraftCodec.encode(uid, tripId, record).toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
    private fun pickDate(field: String, from: LocalDate, target: LocalDate) {
        compose.onNodeWithTag("trip.change.$field.date").performScrollTo().assertIsEnabled().performClick()
        enterNativePickerDate(from, target)
    }
    private fun pickTime(field: String, target: ZonedDateTime) {
        compose.onNodeWithTag("trip.change.$field.time").performScrollTo().assertIsEnabled().performClick()
        enterNativePickerTime(target.toLocalTime())
    }
    private fun assertDate(field: String, value: LocalDate) = compose.onNodeWithTag("trip.change.$field.date").performScrollTo()
        .assertTextEquals(value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
    private fun assertTime(field: String, value: ZonedDateTime) = compose.onNodeWithTag("trip.change.$field.time").performScrollTo()
        .assertTextEquals("${value.format(DateTimeFormatter.ofPattern("HH:mm"))} · Bruxelles")
    private fun closeEditor() {
        compose.onNodeWithTag("trip.change.close").assertIsDisplayed().assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun stage(name: String, action: (JSONObject) -> Unit) {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        AndroidRuntime.create(context); check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val args = InstrumentationRegistry.getArguments()
        fun argument(key: String) = requireNotNull(args.getString(key))
        tripId = argument("scheduleDraftTripId"); otherTripId = argument("scheduleDraftOtherTripId"); check(tripId != otherTripId)
        fun time(key: String) = Instant.parse(argument(key)).atZone(BelgianTripZone)
        original = time("scheduleDraftOriginalDeparture"); departure = time("scheduleDraftDeparture"); arrival = time("scheduleDraftArrival")
        check(departure.toInstant().isAfter(Instant.now()) && arrival.toInstant().isAfter(departure.toInstant()))
        check(departure.toLocalDate() != original.toLocalDate() && departure.toLocalTime() != original.toLocalTime())
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-ui-private-schedule-draft-restart").put("stage", name).put("completed", false)
            .put("actorUserId", uid).put("tripId", tripId).put("otherTripId", otherTripId).put("processId", Process.myPid())
        try { action(result); write(name, result.put("completed", true)) }
        catch (failure: Throwable) {
            try { write(name, result.put("completed", false)) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
            throw failure
        }
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
    private fun write(name: String, value: JSONObject) = File(directory(), "local-trip-schedule-draft-$name.json").writeText(value.toString(2))
}
