package be.sportgreenmoove.app.ui

import android.os.Process
import android.util.Base64
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
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

@SdkSuppress(minSdkVersion = 29)
class LocalTripConsentRecoveryTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var session: JSONObject
    private lateinit var activity: ActivityScenario<MainActivity>
    private lateinit var fixtures: List<JSONObject>
    private lateinit var secondEmail: String
    private val proposals = mutableMapOf<String, String>()

    @Test fun prepareRecoveryStates() = stage("before") { result ->
        AndroidRuntime.create(context).auth.signOut()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            login(session.getString("driver"), "sgm-qa-driver")
            for (fixture in fixtures) {
                driverTrip(fixture, review = false)
                enterTripFormText(compose, "trip.change.price", "4,00")
                compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick()
                expectStatus("Accords des parents en attente")
                compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 0 / 2")
                proposals[fixture.getString("kind")] = requireNotNull(trip(fixture).pendingChangeId)
                if (fixture.getString("kind") == "withdrawn") {
                    compose.onNodeWithTag("trip.change.withdraw").performScrollTo().assertIsEnabled().performClick()
                    expectStatus("Proposition retirée, trajet initial conservé")
                }
                closeDialog()
            }
            logout()
            login(session.getString("parent"), "sgm-qa-parent")
            reservations()
            for ((kind, decision) in listOf("partial" to "accept", "declined" to "decline")) {
                val fixture = fixtures.single { it.getString("kind") == kind }
                openParent(fixture.getString("bookingId"))
                compose.onNodeWithTag("trip.change.$decision").performScrollTo().assertIsEnabled().performClick()
                val label = if (decision == "accept") "Votre accord est enregistré." else "Votre refus est enregistré."
                waitFor("trip.change.decision")
                compose.onNodeWithTag("trip.change.decision").assertTextEquals(label)
                expectStatus(if (decision == "accept") "Accords des parents en attente" else "Modification refusée, trajet initial conservé")
                closeDialog()
            }
            val records = JSONArray()
            for (fixture in fixtures) {
                verifyParent(fixture, second = false, capture = false)
                records.put(record(fixture).put("prepared", true))
            }
            result.put("records", records)
        }
    }

    @Test fun reopenRecoveryStates() = stage("after") { result ->
        val before = JSONObject(File(directory(), "local-trip-consent-recovery-before.json").readText())
        check(before.getString("runId") == session.getString("runId") && before.getBoolean("completed"))
        assertNotEquals("A new app process is required", before.getInt("processId"), Process.myPid())
        val prepared = before.getJSONArray("records")
        check(prepared.length() == fixtures.size)
        for ((index, fixture) in fixtures.withIndex()) {
            val saved = prepared.getJSONObject(index)
            for (key in listOf("kind", "tripId", "bookingId")) assertEquals(fixture.getString(key), saved.getString(key))
            proposals[fixture.getString("kind")] = saved.getString("proposalId")
        }
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            activity = scenario
            waitFor(SgmTestTags.HomeScreen)
            assertEquals("sgm-qa-parent", FirebaseAuth.getInstance().currentUser?.uid)
            compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertDoesNotExist()
            result.put("sessionRestoredWithoutLogin", true)
            reservations()
            val records = JSONArray()
            for (fixture in fixtures) {
                verifyParent(fixture, second = false, capture = true)
                val record = record(fixture).put("parentStateRestored", true).put("refreshUnchanged", true)
                record.put(if (isOpen(fixture)) "originalProposalRestored" else "closedActionsAbsent", true)
                if (!isOpen(fixture)) record.put("parentHistoryRestored", true)
                records.put(record)
            }
            logout()
            login(secondEmail, "sgm-qa-trip-change-parent-two")
            reservations()
            for ((index, fixture) in fixtures.withIndex()) {
                compose.onNodeWithTag("reservation.change.${fixture.getString("bookingId")}").assertDoesNotExist()
                verifyParent(fixture, second = true, capture = false)
                records.getJSONObject(index).put("secondParentScoped", true)
                if (!isOpen(fixture)) records.getJSONObject(index).put("secondParentHistoryScoped", true)
            }
            logout()
            login(session.getString("driver"), "sgm-qa-driver")
            for ((index, fixture) in fixtures.withIndex()) {
                driverTrip(fixture, review = isOpen(fixture))
                if (isOpen(fixture)) {
                    assertReview(fixture, second = false, driver = true)
                    compose.onNodeWithTag("trip.change.withdraw").performScrollTo().assertIsEnabled()
                    refreshReview()
                    assertReview(fixture, second = false, driver = true)
                } else {
                    compose.onNodeWithTag("trip.change.price").assertTextContains("2,50")
                    compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
                    compose.onNodeWithTag("trip.change.status").assertDoesNotExist()
                }
                closeDialog()
                if (!isOpen(fixture)) {
                    LocalTripHistoryAssertions(compose).driver(trip(fixture), proposals.getValue(fixture.getString("kind")), fixture.getString("kind"))
                    records.getJSONObject(index).put("driverHistoryRestored", true)
                }
                records.getJSONObject(index).put("driverStateRestored", true)
            }
            result.put("records", records).put("endedAsUserId", FirebaseAuth.getInstance().currentUser?.uid)
        }
    }

    private fun verifyParent(fixture: JSONObject, second: Boolean, capture: Boolean) {
        val booking = fixture.getString(if (second) "secondBookingId" else "bookingId")
        val expectedTime = fixture.getString("expectedTimeLabel")
        assertEquals(expectedTime, trip(fixture).timeLabel)
        compose.onNodeWithTag("reservation.card.$booking").performScrollTo()
            .assert(hasAnyDescendant(hasText(" · $expectedTime", substring = true)))
        if (isOpen(fixture)) {
            assertEquals(proposals.getValue(fixture.getString("kind")), trip(fixture).pendingChangeId)
            openParent(booking)
            assertReview(fixture, second, driver = false)
            repeat(2) { refreshReview(); assertReview(fixture, second, driver = false) }
            if (capture) {
                compose.onNodeWithTag("trip.change.status").performScrollTo()
                captureLocalUi(compose, "local-trip-consent-recovery-${fixture.getString("kind")}.png", dialog = true)
            }
            closeDialog()
        } else {
            assertEquals(null, trip(fixture).pendingChangeId)
            repeat(2) {
                compose.onNodeWithTag("bookings.refresh").performScrollTo().assertIsEnabled().performClick()
                readyBookings()
                compose.onNodeWithTag("reservation.status.$booking").performScrollTo().assertTextEquals("Approuvée")
                compose.onNodeWithTag("reservation.card.$booking").assert(hasAnyDescendant(hasText("1 place · 2,50 EUR / place")))
                compose.onNodeWithTag("reservation.change.$booking").assertDoesNotExist()
            }
            if (capture) captureLocalUi(compose, "local-trip-consent-recovery-${fixture.getString("kind")}.png")
            LocalTripHistoryAssertions(compose).parent(booking, proposals.getValue(fixture.getString("kind")), fixture.getString("kind"), capture)
        }
    }
    private fun assertReview(fixture: JSONObject, second: Boolean, driver: Boolean) {
        expectStatus("Accords des parents en attente")
        idleReview()
        val partial = fixture.getString("kind") == "partial"
        compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : ${if (partial) 1 else 0} / 2")
        val accepted = partial && !second && !driver
        if (accepted) compose.onNodeWithTag("trip.change.decision").assertTextEquals("Votre accord est enregistré.")
        else compose.onNodeWithTag("trip.change.decision").assertDoesNotExist()
        for (action in listOf("accept", "decline")) {
            val control = compose.onNodeWithTag("trip.change.$action")
            if (driver || accepted) control.assertDoesNotExist() else control.performScrollTo().assertIsEnabled()
        }
        compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.original").performScrollTo().assert(hasAnyDescendant(hasText("2,50 EUR / place")))
        compose.onNodeWithTag("trip.change.proposed").performScrollTo().assert(hasAnyDescendant(hasText("4,00 EUR / place")))
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
        val input = JSONArray(String(Base64.decode(requireNotNull(args.getString("consentRecoveryFixtures")), Base64.URL_SAFE), Charsets.UTF_8))
        fixtures = (0 until input.length()).map(input::getJSONObject)
        check(fixtures.map { it.getString("kind") } == listOf("pending", "partial", "declined", "withdrawn"))
        secondEmail = requireNotNull(args.getString("consentRecoverySecondEmail"))
        val result = JSONObject().put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("scope", "native-ui-trip-consent-recovery-matrix").put("stage", name).put("completed", false)
            .put("actorUserId", "sgm-qa-parent").put("processId", Process.myPid())
        try { action(result); result.put("completed", true); write(name, result) }
        catch (failure: Throwable) {
            try { write(name, result.put("completed", false)) } catch (diagnostic: Throwable) { failure.addSuppressed(diagnostic) }
            throw failure
        }
    }
    private fun record(fixture: JSONObject) = JSONObject().put("kind", fixture.getString("kind"))
        .put("tripId", fixture.getString("tripId")).put("bookingId", fixture.getString("bookingId"))
        .put("proposalId", proposals.getValue(fixture.getString("kind")))
    private fun isOpen(fixture: JSONObject) = fixture.getString("kind") in setOf("pending", "partial")
    private fun trip(fixture: JSONObject) = runBlocking {
        AndroidRuntime.create(context).firebase.searchTrips().single { it.id == fixture.getString("tripId") }
    }
    private fun login(email: String, uid: String) {
        waitFor(SgmTestTags.AuthEmailInput)
        AuthTestInteractions(compose, activity).use { it.signIn(email, session.getString("password")) }
        assertEquals(uid, FirebaseAuth.getInstance().currentUser?.uid)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailInput)
    }
    private fun reservations() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithText("RÉSERVATIONS").performClick()
        readyBookings()
    }
    private fun readyBookings() {
        waitFor("bookings.refresh")
        compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag("bookings.refresh").assertIsEnabled() }.isSuccess }
        compose.onNodeWithTag("bookings.error").assertDoesNotExist()
    }
    private fun openParent(booking: String) {
        readyBookings()
        waitFor("reservation.change.$booking")
        compose.onNodeWithTag("reservation.change.$booking").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.status"); idleReview()
    }
    private fun driverTrip(fixture: JSONObject, review: Boolean) {
        val trip = trip(fixture)
        assertEquals(if (review) proposals.getValue(fixture.getString("kind")) else null, trip.pendingChangeId)
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        selectLocalTripMonth(compose, trip)
        val id = fixture.getString("tripId")
        val action = if (review) "review" else "edit"
        waitFor("trip.$action.$id")
        compose.onNodeWithTag("trip.${if (review) "edit" else "review"}.$id").assertDoesNotExist()
        compose.onNodeWithTag("trip.$action.$id").performScrollTo().assertIsEnabled().performClick()
        waitFor(if (review) "trip.change.status" else "trip.change.price")
        idleReview()
        compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
    }
    private fun refreshReview() {
        compose.onNodeWithTag("trip.change.refresh").performScrollTo().assertIsEnabled().performClick()
        compose.waitForIdle()
        idleReview(); compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
    }
    private fun idleReview() = compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
    private fun expectStatus(label: String) {
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag("trip.change.status").assertTextEquals(label) }.isSuccess
        }
        idleReview()
        compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
    }
    private fun closeDialog() {
        idleReview(); compose.onNodeWithTag("trip.change.close").assertIsDisplayed().assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(context.getExternalFilesDir(null), "local-ui-evidence").also { check(it.isDirectory || it.mkdirs()) }
    private fun write(name: String, result: JSONObject) = File(directory(), "local-trip-consent-recovery-$name.json").writeText(result.toString(2))
}
