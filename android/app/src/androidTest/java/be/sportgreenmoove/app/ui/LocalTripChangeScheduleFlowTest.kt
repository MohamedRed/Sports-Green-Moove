package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.domain.BelgianTripZone
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@SdkSuppress(minSdkVersion = 29)
class LocalTripChangeScheduleFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test fun parentConfirmsNewDateAndArrivalOnlyAfterInvalidScheduleIsCorrected() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val args = InstrumentationRegistry.getArguments()
        fun arg(name: String) = requireNotNull(args.getString(name))
        fun time(name: String) = Instant.parse(arg(name)).atZone(BelgianTripZone)
        val tripId = arg("tripScheduleTripId")
        val bookingId = arg("tripScheduleBookingId")
        val original = time("tripScheduleOriginalDeparture")
        val proposed = time("tripScheduleProposedDeparture")
        val past = time("tripSchedulePastDeparture")
        val arrival = time("tripScheduleDesiredArrival")
        check(past.toInstant().isBefore(Instant.now()) && arrival.toInstant().isAfter(proposed.toInstant()))
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            fun login(key: String) {
                waitFor(SgmTestTags.AuthEmailInput)
                AuthTestInteractions(compose, activity).use { it.signIn(session.getString(key), session.getString("password")) }
            }
            login("driver")
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } })
            waitFor("trip.edit.$tripId")
            compose.onNodeWithTag("trip.edit.$tripId").performScrollTo().assertIsEnabled().performClick()
            waitFor("trip.change.departure.date")
            pickDate("departure", original.toLocalDate(), proposed.toLocalDate(), confirm = false)
            assertDate("departure", original.toLocalDate())
            compose.onNodeWithTag("trip.change.propose").assertIsNotEnabled()
            pickDate("departure", original.toLocalDate(), past.toLocalDate())
            assertDate("departure", past.toLocalDate())
            invalid("Le départ doit être dans le futur.")
            pickDate("departure", past.toLocalDate(), proposed.toLocalDate())
            assertDate("departure", proposed.toLocalDate())
            pickTime("departure", proposed)
            compose.onNodeWithTag("trip.change.arrival.enabled").performScrollTo().assertIsOff().performClick()
            compose.onNodeWithTag("trip.change.arrival.enabled").assertIsOn()
            invalid("L’arrivée ne peut pas précéder le départ.")
            pickDate("arrival", original.toLocalDate(), arrival.toLocalDate())
            assertDate("arrival", arrival.toLocalDate())
            pickTime("arrival", arrival)
            compose.onNodeWithTag("trip.change.validation").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Accords des parents en attente")
            closeDialog()
            compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
            compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
            login("parent")
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            compose.onNodeWithText("RÉSERVATIONS").performClick()
            waitFor("reservation.change.$bookingId")
            compose.waitUntil(60_000) {
                runCatching { compose.onNodeWithTag("reservation.change.$bookingId").assertIsEnabled() }.isSuccess
            }
            compose.onNodeWithTag("bookings.error").assertDoesNotExist()
            compose.onNodeWithTag("reservation.change.$bookingId").performScrollTo().assertIsEnabled().performClick()
            waitFor("trip.change.status")
            compose.onNodeWithTag("trip.change.original").performScrollTo()
                .assert(hasAnyDescendant(hasText("Départ : ${display(original)}")))
                .assert(hasAnyDescendant(hasText("2,50 EUR / place")))
                .assert(!hasAnyDescendant(hasText("Arrivée souhaitée", substring = true)))
            compose.onNodeWithTag("trip.change.proposed").performScrollTo()
                .assert(hasAnyDescendant(hasText("Départ : ${display(proposed)}")))
                .assert(hasAnyDescendant(hasText("Arrivée souhaitée : ${display(arrival)}")))
                .assert(hasAnyDescendant(hasText("2,50 EUR / place")))
            compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 1")
            compose.onNodeWithTag("trip.change.decision").assertTextEquals("Votre accord est enregistré.")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            idleReview()
            compose.onNodeWithTag("trip.change.proposed").performScrollTo().assertIsDisplayed()
            captureLocalUi(compose, "local-trip-change-date-arrival-confirmed.png", dialog = true)
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
            check(directory.isDirectory || directory.mkdirs())
            val evidence = JSONObject().put("projectId", session.getString("projectId")).put("runId", session.getString("runId"))
                .put("scope", "native-trip-change-date-and-arrival-consent-ui").put("completed", true)
                .put("tripId", tripId).put("bookingId", bookingId)
                .put("originalDepartureAt", arg("tripScheduleOriginalDeparture"))
                .put("proposedDepartureAt", arg("tripScheduleProposedDeparture"))
                .put("desiredArrivalBy", arg("tripScheduleDesiredArrival"))
            for (key in listOf("nativeDatePickerUsed", "nativeTimePickerUsed", "dateCancellationPreservedDraft", "pastDepartureBlocked",
                "arrivalBeforeDepartureBlocked", "desiredArrivalAdded", "parentSawDatesAndArrival", "parentConfirmed", "notApplied")) evidence.put(key, true)
            File(directory, "local-trip-change-schedule-ui.json").writeText(evidence.toString(2))
        }
    }

    private fun pickDate(field: String, from: LocalDate, target: LocalDate, confirm: Boolean = true) {
        compose.onNodeWithTag("trip.change.$field.date").performScrollTo().assertIsEnabled().performClick()
        enterNativePickerDate(from, target, confirm)
    }
    private fun assertDate(field: String, date: LocalDate) = compose.onNodeWithTag("trip.change.$field.date")
        .assertTextEquals(date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
    private fun pickTime(field: String, value: ZonedDateTime) {
        compose.onNodeWithTag("trip.change.$field.time").performScrollTo().assertIsEnabled().performClick()
        enterNativePickerTime(value.toLocalTime())
        compose.onNodeWithTag("trip.change.$field.time").assertTextEquals("${value.format(DateTimeFormatter.ofPattern("HH:mm"))} · Bruxelles")
    }
    private fun invalid(message: String) {
        compose.onNodeWithTag("trip.change.validation").performScrollTo().assertTextEquals(message)
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
    }
    private fun display(time: ZonedDateTime) = time.format(DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm XXX", Locale.forLanguageTag("fr-BE")))
    private fun idleReview() = compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
    private fun closeDialog() {
        idleReview()
        compose.onNodeWithContentDescription("Fermer").assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun expectStatus(label: String) = compose.waitUntil(60_000) {
        runCatching { compose.onNodeWithTag("trip.change.status").assertTextEquals(label) }.isSuccess
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
