package be.sportgreenmoove.app.ui

import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredAuthGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.Instant

class SearchCriteriaFlowTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var current: SearchController
    private lateinit var view: View
    private val visible = mutableStateOf(true)
    private val error = mutableStateOf<String?>(null)
    private val bookings = mutableListOf<Triple<String, String?, Int>>()
    private val searches = mutableListOf<TripSearchCriteria>()
    private val children = listOf(UiFlowFixtures.child.copy(id = "child-a", label = "Enfant A QA"),
        UiFlowFixtures.child.copy(id = "child-b", label = "Enfant B QA"))

    @Test fun navigationRetainsOptionsAndBookingUsesTheCompletedSelection() {
        host()
        selectPlaces()
        option("Enfant B QA")
        option("2 places")
        option("Grand")
        option("Retour")
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).performScrollTo().performTextReplacement("2026-10-17T16:30:00Z")
        search()
        capture("local-search-retained-options.png")
        compose.onNodeWithTag(SgmTestTags.BackAction).performClick()
        compose.onNodeWithTag("search.returnFromHost").assertIsDisplayed().performClick()
        choice("2 places").performScrollTo().assertIsSelected()
        choice("Grand").assertIsSelected()
        choice("Retour").assertIsSelected()
        choice("Suivi enfant").assertIsSelected()
        choice("Consentement").assertIsSelected()
        choice("Enfant B QA").performScrollTo().assertIsSelected()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals("2026-10-17T16:30:00Z")
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo().assertTextEquals("Départ options QA")
        compose.onNodeWithTag(SgmTestTags.SearchDestinationInput).assertTextEquals("Arrivée options QA")
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
        compose.waitUntil(10_000) { bookings.size == 1 }
        compose.runOnIdle {
            assertEquals(Triple(UiFlowFixtures.match.tripId, "child-b", 2), bookings.single())
            assertEquals(2, searches.single().seatsNeeded)
            assertEquals("large", searches.single().baggage)
            assertTrue(searches.single().returnTrip && searches.single().guardianConsent)
        }
    }

    @Test fun eachOptionChangeRemovesResultsAndRejectsThePreviousBookingAction() {
        host()
        selectPlaces()
        option("Suivi enfant")
        val changes: List<() -> Unit> = listOf(
            { option("2 places") }, { option("Grand") }, { option("Retour") }, { option("Enfant B QA") },
            { option("Suivi enfant") }, { option("Consentement") },
            { val next = Instant.parse(current.form.desiredDepartureAtIso).plusSeconds(3600).toString()
                compose.onNodeWithTag(SgmTestTags.SearchDateInput).performScrollTo().performTextReplacement(next) },
        )
        for (change in changes) {
            search()
            val previous = current.matches.single()
            change()
            compose.waitUntil(10_000) { current.matches.isEmpty() && !current.hasSearched }
            compose.runOnIdle { current.requestMatch(previous) }
            compose.runOnIdle { assertTrue(bookings.isEmpty()) }
            compose.onNodeWithText("Relancez la recherche avant de demander ce trajet.").performScrollTo().assertIsDisplayed()
        }
        capture("local-search-options-invalidated.png")
    }

    private fun host() {
        val gateway = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun suggestPlaces(input: String) = listOf(PlaceSuggestion(input, input, input, null))
            override suspend fun resolvePlace(placeId: String) = UiFlowFixtures.origin.copy(placeId = placeId, label = placeId, formattedAddress = "Adresse $placeId")
            override suspend fun searchTripMatches(criteria: TripSearchCriteria): List<be.sportgreenmoove.app.data.TripMatchSummary> {
                searches += criteria
                return listOf(UiFlowFixtures.match.let { it.copy(summary = it.summary.copy(seatsAvailable = 4)) })
            }
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int): String {
                bookings += Triple(trip.id, childId, seats)
                return "synthetic-booking"
            }
        }
        val providers = AndroidProviderSet(UnconfiguredAuthGateway(), gateway)
        compose.setSgmUiTestContent {
            view = LocalView.current
            current = rememberSearchController(providers, rememberCoroutineScope(), "criteria-parent", { error.value = it }, {}, {})
            if (visible.value) SearchRoute(current, children, error.value, { visible.value = false })
            else V2Button("Revenir à la recherche", { visible.value = true }, testTag = "search.returnFromHost")
        }
    }
    private fun selectPlaces() {
        for ((tag, label) in listOf(SgmTestTags.SearchOriginInput to "Départ options QA",
            SgmTestTags.SearchDestinationInput to "Arrivée options QA")) {
            compose.onNodeWithTag(tag).performScrollTo().performTextReplacement(label)
            compose.onNodeWithTag("$tag.suggest").performClick()
            val row = "$tag.option.$label"
            compose.waitUntil(10_000) { compose.onAllNodesWithTag(row).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithTag(row).performScrollTo().performClick()
            compose.waitUntil(10_000) { compose.onAllNodesWithText("Adresse $label").fetchSemanticsNodes().isNotEmpty() }
        }
    }
    private fun choice(label: String) = compose.onNode(hasText(label) and hasClickAction())
    private fun option(label: String) { choice(label).performScrollTo().performClick() }
    private fun search() {
        if (!current.form.guardianConsent) option("Consentement")
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        compose.waitUntil(10_000) { current.hasSearched && current.matches.isNotEmpty() }
    }
    private fun capture(name: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync { view.context.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(view.windowToken, 0) }
        compose.waitUntil(10_000) {
            var visible = false
            instrumentation.runOnMainSync { visible = ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime()) == true }
            !visible
        }
        compose.onNodeWithText("RECHERCHE").performScrollTo().assertIsDisplayed()
        captureLocalUi(compose, name)
    }
}
