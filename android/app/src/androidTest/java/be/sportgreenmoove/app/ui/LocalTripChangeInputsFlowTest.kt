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
import java.time.format.DateTimeFormatter
import java.util.Locale

@SdkSuppress(minSdkVersion = 29)
class LocalTripChangeInputsFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()

    @Test fun parentConfirmsNewTimeWhileUnconfirmedAddressesAndMissingRouteCannotBeApplied() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val args = InstrumentationRegistry.getArguments()
        fun arg(name: String) = requireNotNull(args.getString(name))
        val tripId = arg("tripInputsTripId")
        val bookingId = arg("tripInputsBookingId")
        val original = arg("tripInputsOriginalDeparture")
        val proposed = arg("tripInputsProposedDeparture")
        val proposedTime = Instant.parse(proposed).atZone(BelgianTripZone).toLocalTime()
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            fun login(key: String) {
                waitFor(SgmTestTags.AuthEmailInput)
                AuthTestInteractions(compose, activity).use { it.signIn(session.getString(key), session.getString("password")) }
            }
            fun trips() {
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } })
            }
            login("driver")
            trips()
            waitFor("trip.edit.$tripId")
            compose.onNodeWithTag("trip.edit.$tripId").performScrollTo().assertIsEnabled().performClick()
            waitFor("trip.change.departure.time")
            compose.onNodeWithTag("trip.change.departure.time").performScrollTo().assertIsEnabled().performClick()
            enterNativePickerTime(proposedTime)
            compose.onNodeWithTag("trip.change.departure.time")
                .assertTextEquals("${proposedTime.format(DateTimeFormatter.ofPattern("HH:mm"))} · Bruxelles")
            enterTripFormText(compose, "trip.change.price", "4,00")
            for ((place, label) in listOf("origin" to "L’adresse de départ", "destination" to "L’adresse d’arrivée")) {
                enterTripFormText(compose, "trip.change.$place.input", "Adresse QA non confirmée")
                compose.onNodeWithTag("trip.change.validation").performScrollTo()
                    .assertTextEquals("$label n’est pas encore confirmée.")
                compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
                compose.onNodeWithTag("trip.change.$place.keep").performScrollTo().assertIsEnabled().performClick()
                compose.onNodeWithTag("trip.change.validation").assertDoesNotExist()
                compose.onNodeWithTag("trip.change.propose").assertIsEnabled()
            }
            compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Accords des parents en attente")
            closeDialog()
            logout()
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
            assertTerms("original", original, "2,50 EUR / place")
            assertTerms("proposed", proposed, "4,00 EUR / place")
            compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 1")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            idleReview()
            compose.onNodeWithTag("trip.change.proposed").performScrollTo().assertIsDisplayed()
            captureLocalUi(compose, "local-trip-change-time-confirmed.png", dialog = true)
            closeDialog()
            logout()
            login("driver")
            trips()
            waitFor("trip.review.$tripId")
            compose.onNodeWithTag("trip.review.$tripId").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.calculate").performScrollTo().assertIsEnabled().performClick()
            compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.error").fetchSemanticsNodes().isNotEmpty() }
            idleReview()
            compose.onNodeWithTag("trip.change.error").performScrollTo()
                .assertTextEquals("Itinéraire non confirmé. Actualisez avant de réessayer.")
            compose.onNodeWithTag("trip.change.quote").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            captureLocalUi(compose, "local-trip-change-route-unavailable.png", dialog = true)
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
            check(directory.isDirectory || directory.mkdirs())
            val evidence = JSONObject().put("projectId", session.getString("projectId")).put("runId", session.getString("runId"))
                .put("scope", "native-trip-change-time-and-address-safety-ui").put("completed", true)
                .put("tripId", tripId).put("bookingId", bookingId).put("originalDepartureAt", original).put("proposedDepartureAt", proposed)
            for (key in listOf("nativeTimePickerUsed", "unconfirmedOriginBlocked", "unconfirmedDestinationBlocked",
                "originalPlacesExplicitlyKept", "parentSawBothTimes", "parentConfirmed", "missingRouteBlockedApplication")) evidence.put(key, true)
            File(directory, "local-trip-change-inputs-ui.json").writeText(evidence.toString(2))
        }
    }

    private fun assertTerms(tag: String, departure: String, price: String) {
        val date = Instant.parse(departure).atZone(BelgianTripZone)
            .format(DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm XXX", Locale.forLanguageTag("fr-BE")))
        compose.onNodeWithTag("trip.change.$tag").performScrollTo().assertIsDisplayed()
            .assert(hasAnyDescendant(hasText("Départ : $date"))).assert(hasAnyDescendant(hasText(price)))
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailInput)
    }
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
