package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

@SdkSuppress(minSdkVersion = 29)
class LocalTripChangeFlowTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var session: JSONObject

    @Test fun twoParentsConfirmSeparatelyWhileRefusalAndWithdrawalKeepTheInitialTrip() {
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa")
        val args = InstrumentationRegistry.getArguments()
        fun arg(name: String) = requireNotNull(args.getString(name))
        val confirmed = arg("tripChangeConfirmedId")
        val declined = arg("tripChangeDeclinedId")
        val withdrawn = arg("tripChangeWithdrawnId")
        val firstBooking = arg("tripChangeFirstBooking")
        val secondBooking = arg("tripChangeSecondBooking")
        val refusedBooking = arg("tripChangeRefusedBooking")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            login(activity, session.getString("driver"))
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == confirmed } })
            for (tripId in listOf(confirmed, declined, withdrawn)) {
                waitFor("trip.edit.$tripId")
                compose.onNodeWithTag("trip.edit.$tripId").performScrollTo().assertIsEnabled().performClick()
                waitFor("trip.change.price")
                enterTripFormText(compose, "trip.change.price", "4,00")
                compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick()
                expectStatus("Accords des parents en attente")
                compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 0 / 2")
                closeDialog()
            }
            logout()
            login(activity, session.getString("parent"))
            reservations()
            openReservation(firstBooking)
            decide("accept", "Votre accord est enregistré.")
            expectStatus("Accords des parents en attente")
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 2")
            capture("local-trip-change-first-parent.png")
            closeDialog()
            openReservation(refusedBooking)
            decide("decline", "Votre refus est enregistré.")
            expectStatus("Modification refusée, trajet initial conservé")
            capture("local-trip-change-parent-refused.png")
            closeDialog()
            compose.onNodeWithTag("reservation.status.$refusedBooking").performScrollTo().assertTextEquals("Approuvée")
            compose.onNodeWithTag("reservation.change.$refusedBooking").assertDoesNotExist()
            logout()
            login(activity, arg("tripChangeSecondParentEmail"))
            reservations()
            compose.onNodeWithTag("reservation.change.$firstBooking").assertDoesNotExist()
            openReservation(secondBooking)
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 2")
            decide("accept", "Votre accord est enregistré.")
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 2 / 2")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            capture("local-trip-change-both-parents.png")
            closeDialog()
            logout()
            login(activity, session.getString("driver"))
            compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
            selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == confirmed } })
            openDriverReview(confirmed)
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.calculate").performScrollTo().assertIsDisplayed().assertIsEnabled()
            closeDialog()
            openDriverReview(withdrawn)
            compose.onNodeWithTag("trip.change.withdraw").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Proposition retirée, trajet initial conservé")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            capture("local-trip-change-withdrawn.png")
            closeDialog()
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
            check(directory.isDirectory || directory.mkdirs())
            val evidence = JSONObject().put("projectId", session.getString("projectId")).put("runId", session.getString("runId"))
                .put("scope", "native-three-account-trip-consent-ui").put("completed", true)
                .put("confirmedTripId", confirmed).put("declinedTripId", declined).put("withdrawnTripId", withdrawn)
            for (key in listOf("firstParentPending", "secondParentConfirmed", "refusalVisible", "withdrawalVisible", "routeRequiredBeforeApplication"))
                evidence.put(key, true)
            File(directory, "local-trip-change-ui.json").writeText(evidence.toString(2))
        }
    }

    private fun login(activity: ActivityScenario<MainActivity>, email: String) {
        waitFor(SgmTestTags.AuthEmailInput)
        AuthTestInteractions(compose, activity).use { it.signIn(email, session.getString("password")) }
    }
    private fun capture(name: String) {
        compose.onNodeWithTag("trip.change.status").performScrollTo().assertIsDisplayed()
        captureLocalUi(compose, name, dialog = true)
    }
    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailInput)
    }
    private fun reservations() {
        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithText("RÉSERVATIONS").performClick()
        waitFor("bookings.refresh")
    }
    private fun openReservation(id: String) {
        waitFor("reservation.change.$id")
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag("reservation.change.$id").assertIsEnabled() }.isSuccess
        }
        compose.onNodeWithTag("bookings.error").assertDoesNotExist()
        compose.onNodeWithTag("reservation.change.$id").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.original").performScrollTo().assertIsDisplayed()
            .assert(hasAnyDescendant(hasText("2,50 EUR / place")))
        compose.onNodeWithTag("trip.change.proposed").performScrollTo().assertIsDisplayed()
            .assert(hasAnyDescendant(hasText("4,00 EUR / place")))
    }
    private fun openDriverReview(id: String) {
        waitFor("trip.review.$id")
        compose.onNodeWithTag("trip.review.$id").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.status")
    }
    private fun decide(decision: String, label: String) {
        compose.onNodeWithTag("trip.change.$decision").performScrollTo().assertIsEnabled().performClick()
        waitFor("trip.change.decision")
        compose.onNodeWithTag("trip.change.decision").performScrollTo().assertTextEquals(label)
        compose.onNodeWithTag("trip.change.accept").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.decline").assertDoesNotExist()
    }
    private fun expectStatus(label: String) {
        compose.waitUntil(60_000) {
            runCatching { compose.onNodeWithTag("trip.change.status").assertTextEquals(label) }.isSuccess
        }
    }
    private fun closeDialog() {
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithContentDescription("Fermer").assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
}
