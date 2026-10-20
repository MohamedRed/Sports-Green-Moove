package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ReservationDecision
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
import java.security.MessageDigest
import java.time.Instant

class LocalParentSearchBookingTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private lateinit var runtime: be.sportgreenmoove.app.services.AndroidProviderSet
    private val screenshots = JSONObject()

    @Test fun parentSearchesAndRequestsTwoSeatsThenDriverApprovesAndParentCancelsInApp() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && args.containsKey("searchBookingApproved"))
        val context = instrumentation.targetContext
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(UiDevice.getInstance(instrumentation).executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(args.getString("searchBookingApproved") == session.getString("runId"))
        val tripId = requireNotNull(args.getString("searchBookingTripId")).also { check(it.isNotBlank()) }
        val departure = requireNotNull(args.getString("searchBookingDeparture"))
        check(Instant.parse(departure).isAfter(Instant.now()))
        runtime = AndroidRuntime.create(context)
        val places = mutableListOf<String>()
        var bookingId: String? = null
        var failure: Throwable? = null
        try {
            runtime.auth.signOut()
            ActivityScenario.launch(MainActivity::class.java).use { activity ->
                fun login(actor: String) {
                    waitFor(SgmTestTags.AuthEmailInput)
                    AuthTestInteractions(compose, activity).use { it.signIn(session.getString(actor), session.getString("password")) }
                    assertEquals(if (actor == "parent") "sgm-qa-parent" else "sgm-qa-driver", FirebaseAuth.getInstance().currentUser?.uid)
                }
                login("parent")
                val initialTrip = trip(tripId)
                assertEquals("sgm-qa-driver", initialTrip.driverUserId)
                assertEquals("Trajet QA recherche deux places", initialTrip.title)
                assertEquals(departure, initialTrip.departureAtIso)
                assertEquals(0, checkNotNull(initialTrip.bookingIntent).priceCents)
                assertEquals(4, available(tripId))
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                compose.onNodeWithContentDescription("Rechercher un trajet").assertIsDisplayed().performClick()
                waitFor(SgmTestTags.SearchScreen)
                for ((tag, query) in listOf(SgmTestTags.SearchOriginInput to "Gare de Wavre",
                    SgmTestTags.SearchDestinationInput to "Gare de Bruxelles-Central")) {
                    compose.onNodeWithTag(tag).performScrollTo().performTextReplacement(query)
                    compose.onNodeWithTag("$tag.suggest").performScrollTo().performClick()
                    val prefix = "$tag.option."
                    val suggestions = SemanticsMatcher("Provider place suggestion") {
                        it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith(prefix) == true
                    }
                    compose.waitUntil(60_000) { compose.onAllNodes(suggestions).fetchSemanticsNodes().isNotEmpty() }
                    val selected = compose.onAllNodes(suggestions).fetchSemanticsNodes().first().config[SemanticsProperties.TestTag]
                    places.add(selected.removePrefix(prefix))
                    compose.onNodeWithTag(selected).performScrollTo().performClick()
                    compose.waitUntil(60_000) { compose.onAllNodes(suggestions).fetchSemanticsNodes().isEmpty() }
                    waitFor("$tag.resolved")
                    compose.onNodeWithTag("$tag.resolved").performScrollTo().assertIsDisplayed()
                }
                compose.onNodeWithTag(SgmTestTags.SearchDateInput).performScrollTo().performTextReplacement(departure)
                compose.onNodeWithText("Aucun").performScrollTo().performClick().assertIsSelected()
                compose.onNodeWithText("Lina QA").performScrollTo().performClick().assertIsSelected()
                compose.onNodeWithText("2 places").performScrollTo().performClick().assertIsSelected()
                compose.onNodeWithText("Consentement").performScrollTo().performClick().assertIsSelected()
                capture("choices")
                compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
                waitFor(SgmTestTags.BookingRequestAction)
                assertEquals(1, compose.onAllNodesWithTag(SgmTestTags.BookingRequestAction).fetchSemanticsNodes().size)
                compose.onNodeWithText("Trajet QA recherche deux places").performScrollTo().assertIsDisplayed()
                capture("match")
                compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
                waitFor(SgmTestTags.BookingRequestConfirmed)
                compose.onNodeWithTag(SgmTestTags.BookingRequestConfirmed).performScrollTo().assertTextEquals("Demande envoyée.")
                compose.onNodeWithTag(SgmTestTags.BookingRequestAction).assertDoesNotExist()
                val requested = booking(tripId, AppRole.Parent)
                bookingId = requested.bookingId
                assertBooking(requested, "requested")
                assertEquals(4, available(tripId)); capture("requested")
                verifySearchBookingCheckpoint(session, tripId, requested.bookingId, "requested")
                logout(); login("driver"); reservations()
                val id = checkNotNull(bookingId)
                decide(id, ReservationDecision.Approve, "Approuvée")
                assertBooking(booking(tripId, AppRole.Driver), "approved")
                assertEquals(2, available(tripId)); capture("driver-approved")
                verifySearchBookingCheckpoint(session, tripId, id, "approved")
                logout(); login("parent"); reservations()
                expectStatus(id, "Approuvée")
                assertBooking(booking(tripId, AppRole.Parent), "approved")
                assertEquals(2, available(tripId)); capture("parent-approved")
                decide(id, ReservationDecision.Cancel, "Annulée")
                assertBooking(booking(tripId, AppRole.Parent), "cancelled")
                assertEquals(4, available(tripId)); capture("cancelled")
                verifySearchBookingCheckpoint(session, tripId, id, "cancelled")
                logout()
            }
        } catch (error: Throwable) { failure = error }
        finally {
            for (cleanup in listOf<() -> Unit>({ runtime.auth.signOut() },
                { runBlocking { FirebaseFirestore.getInstance().terminate().await() } })) {
                try { cleanup() } catch (error: Throwable) {
                    val previous = failure
                    if (previous == null) failure = error else previous.addSuppressed(error)
                }
            }
        }
        failure?.let { throw it }
        assertNull(FirebaseAuth.getInstance().currentUser)
        assertEquals(2, places.toSet().size)
        File(directory(), "local-parent-search-booking-device.json").writeText(JSONObject()
            .put("scope", "local-parent-search-two-seat-booking-not-physical-or-payment")
            .put("projectId", session.getString("projectId")).put("runId", session.getString("runId"))
            .put("tripId", tripId).put("bookingId", checkNotNull(bookingId)).put("selectedPlaceIds", JSONArray(places))
            .put("requestedSeats", 2).put("childId", "sgm-qa-child-lina").put("screenshots", screenshots)
            .put("parentRequestedInApp", true).put("driverApprovedInApp", true).put("parentCancelledInApp", true)
            .put("capacitySequence", JSONArray(listOf(4, 4, 2, 2, 4)))
            .put("parentSignedOut", true).put("firestoreClientTerminated", true).put("completed", true)
            .put("physicalDevice", false).put("paymentExercised", false).toString(2))
    }

    private fun booking(tripId: String, role: AppRole) = runBlocking {
        runtime.reservations.list(role).items.single { it.booking.tripId == tripId }.booking
    }
    private fun trip(tripId: String) = runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } }
    private fun available(tripId: String) = trip(tripId).seatsAvailable
    private fun assertBooking(booking: BookingRequestSummary, status: String) {
        assertEquals("sgm-qa-parent", booking.parentUserId); assertEquals("sgm-qa-child-lina", booking.childId)
        assertEquals(2, booking.seats); assertEquals(status, booking.status)
    }
    private fun reservations() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithText("RÉSERVATIONS").performClick(); waitFor("bookings.refresh")
    }
    private fun decide(id: String, decision: ReservationDecision, status: String) {
        val tag = "booking.${decision.wire}.action.$id"
        compose.waitUntil(60_000) { runCatching { compose.onNodeWithTag(tag).assertIsEnabled() }.isSuccess }
        compose.onNodeWithTag(tag).performScrollTo().performClick(); waitFor("bookings.confirm")
        compose.onNodeWithTag("bookings.confirm").performClick(); expectStatus(id, status)
        compose.onNodeWithTag(tag).assertDoesNotExist()
    }
    private fun expectStatus(id: String, status: String) = compose.waitUntil(60_000) {
        runCatching { compose.onNodeWithTag("reservation.status.$id").performScrollTo().assertTextEquals(status) }.isSuccess
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick(); waitFor(SgmTestTags.AuthEmailInput)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun directory() = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
    private fun capture(id: String) {
        val name = "local-parent-search-booking-$id.png"; captureLocalUi(compose, name)
        screenshots.put(name, MessageDigest.getInstance("SHA-256").digest(File(directory(), name).readBytes()).joinToString("") { "%02x".format(it) })
    }
}
