package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.test.core.app.ActivityScenario
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.MainActivity
import be.sportgreenmoove.app.services.AndroidRuntime
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.Locale

@SdkSuppress(minSdkVersion = 29)
class LocalRealMapsTripChangeTest {
    @get:Rule val compose = createLocalAppComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private lateinit var session: JSONObject

    @Test fun realPlacesAndRouteAreAppliedByDriverOnlyAfterBothParentsConfirm() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && args.getString("realMapsApproved") != null)
        val context = instrumentation.targetContext
        session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(args.getString("realMapsApproved") == session.getString("runId"))
        fun arg(key: String) = requireNotNull(args.getString(key))
        val tripId = arg("realMapsTripId")
        val firstBooking = arg("realMapsFirstBooking")
        val secondBooking = arg("realMapsSecondBooking")
        val runtime = AndroidRuntime.create(context)
        runtime.auth.signOut()
        UiDevice.getInstance(instrumentation).setOrientationNatural()
        val selectedIds = mutableListOf<String>()
        ActivityScenario.launch(MainActivity::class.java).use { activity ->
            fun login(email: String) {
                waitFor(SgmTestTags.AuthEmailInput)
                AuthTestInteractions(compose, activity).use { it.signIn(email, session.getString("password")) }
            }
            fun trips() {
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                selectLocalTripMonth(compose, runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } })
            }
            fun originalStillStored() {
                val trip = runBlocking { runtime.firebase.searchTrips().single { it.id == tripId } }
                val map = requireNotNull(trip.mapPreview)
                check(map.start.lat == 50.7167 && map.start.lng == 4.6167)
                check(map.end.lat == 50.8503 && map.end.lng == 4.3517)
            }
            login(session.getString("driver")); trips()
            waitFor("trip.edit.$tripId")
            compose.onNodeWithTag("trip.edit.$tripId").performScrollTo().assertIsEnabled().performClick()
            waitFor("trip.change.origin.input")
            for ((tag, query) in listOf("origin" to "Gare de Wavre", "destination" to "Gare de Louvain-la-Neuve")) {
                enterTripFormText(compose, "trip.change.$tag.input", query)
                compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
                compose.onNodeWithTag("trip.change.$tag.search").performScrollTo().assertIsEnabled().performClick()
                val prefix = "trip.change.$tag.suggestion."
                val suggestions = SemanticsMatcher("Real place suggestion") {
                    it.config.getOrNull(SemanticsProperties.TestTag)?.startsWith(prefix) == true
                }
                compose.waitUntil(60_000) { compose.onAllNodes(suggestions).fetchSemanticsNodes().isNotEmpty() }
                val selected = compose.onAllNodes(suggestions).fetchSemanticsNodes().first().config[SemanticsProperties.TestTag]
                selectedIds.add(selected.removePrefix(prefix))
                compose.onNodeWithTag(selected).performScrollTo().assertIsEnabled().performClick()
                compose.waitUntil(60_000) {
                    compose.onAllNodes(suggestions).fetchSemanticsNodes().isEmpty() &&
                        compose.onAllNodesWithTag("trip.change.validation").fetchSemanticsNodes().isEmpty()
                }
            }
            compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled()
            captureLocalUi(compose, "local-real-maps-selected.png", dialog = true)
            compose.onNodeWithTag("trip.change.propose").performClick()
            expectStatus("Accords des parents en attente")
            compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 0 / 2")
            compose.onNodeWithTag("trip.change.calculate").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            val proposalId = requireNotNull(runBlocking { runtime.firebase.searchTrips().single { it.id == tripId }.pendingChangeId })
            val proposed = runBlocking { runtime.firebase.reviewTripChange(tripId, proposalId) }.terms
            originalStillStored(); closeDialog(); logout()
            for ((index, account) in listOf(session.getString("parent"), arg("realMapsSecondParentEmail")).withIndex()) {
                login(account)
                compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
                compose.onNodeWithText("RÉSERVATIONS").performClick()
                val booking = if (index == 0) firstBooking else secondBooking
                waitFor("reservation.change.$booking")
                compose.waitUntil(60_000) {
                    runCatching { compose.onNodeWithTag("reservation.change.$booking").assertIsEnabled() }.isSuccess
                }
                compose.onNodeWithTag("reservation.change.$booking").performScrollTo().performClick()
                waitFor("trip.change.accept")
                compose.onNodeWithTag("trip.change.proposed").performScrollTo().assertIsDisplayed()
                    .assert(hasAnyDescendant(hasText("0,00 EUR / place")))
                    .assert(hasAnyDescendant(hasText(String.format(Locale.ROOT, "Départ : %.6f, %.6f", proposed.origin.lat, proposed.origin.lng))))
                    .assert(hasAnyDescendant(hasText(String.format(Locale.ROOT, "Destination : %.6f, %.6f", proposed.destination.lat, proposed.destination.lng))))
                compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsEnabled().performClick()
                awaitRecordedTripAgreement(compose, acceptedParentCount = index + 1, parentCount = 2)
                expectStatus(if (index == 0) "Accords des parents en attente" else "Tous les parents ont confirmé")
                compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
                compose.onNodeWithTag("trip.change.calculate").assertDoesNotExist()
                originalStillStored()
                closeDialog(); logout()
            }
            login(session.getString("driver")); trips()
            waitFor("trip.review.$tripId")
            compose.onNodeWithTag("trip.review.$tripId").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Tous les parents ont confirmé")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.calculate").performScrollTo().assertIsEnabled().performClick()
            waitFor("trip.change.quote")
            idle()
            compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
            val quoteText = compose.onNodeWithTag("trip.change.quote").fetchSemanticsNode().config[SemanticsProperties.Text].joinToString { it.text }
            check(Regex("[1-9][0-9]* m · [0-9]+ min").matches(quoteText))
            compose.onNodeWithTag("trip.change.apply").performScrollTo().assertIsEnabled().performClick()
            expectStatus("Nouveaux détails appliqués")
            idle()
            compose.onNodeWithTag("trip.change.error").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.applied").performScrollTo().assertTextEquals("Détails appliqués. 0 règlement à vérifier.")
            compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
            compose.onNodeWithTag("trip.change.status").performScrollTo().assertIsDisplayed()
            captureLocalUi(compose, "local-real-maps-applied.png", dialog = true)
            val evidence = JSONObject().put("projectId", session.getString("projectId")).put("runId", session.getString("runId"))
                .put("scope", "native-three-account-real-map-trip-application").put("completed", true).put("tripId", tripId)
                .put("selectedPlaceIds", JSONArray(selectedIds)).put("quoteText", quoteText)
            for (key in listOf("realSuggestionsSelected", "unconfirmedPlaceBlocked", "bothParentsConfirmedInApp",
                "originalTripKeptBeforeApplication", "parentsCannotApply", "routeQuoteRequired", "driverAppliedInApp")) evidence.put(key, true)
            val directory = File(context.getExternalFilesDir(null), "local-ui-evidence")
            check(directory.isDirectory || directory.mkdirs())
            File(directory, "local-real-maps-ui.json").writeText(evidence.toString(2))
        }
    }

    private fun logout() {
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithText("SE DÉCONNECTER").performScrollTo().performClick()
        waitFor(SgmTestTags.AuthEmailInput)
    }
    private fun waitFor(tag: String) = compose.waitUntil(60_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun idle() = compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.busy").fetchSemanticsNodes().isEmpty() }
    private fun expectStatus(text: String) = compose.waitUntil(60_000) {
        runCatching { compose.onNodeWithTag("trip.change.status").assertTextEquals(text) }.isSuccess
    }
    private fun closeDialog() {
        idle(); compose.onNodeWithContentDescription("Fermer").assertIsEnabled().performClick()
        compose.waitUntil(60_000) { compose.onAllNodesWithTag("trip.change.title").fetchSemanticsNodes().isEmpty() }
    }
}
