package be.sportgreenmoove.app.ui

import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onAllNodesWithTag
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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class SearchSessionFlowTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var view: View
    private lateinit var current: SearchController
    private val uid = mutableStateOf("parent-qa")
    private val callbacks = mutableListOf<String>()

    @Test fun editingASelectedPlaceCannotReuseItsOldCoordinates() {
        host(gateway())
        selectPlace(SgmTestTags.SearchOriginInput, "Départ QA")
        selectPlace(SgmTestTags.SearchDestinationInput, "Arrivée QA")
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).assertTextEquals("Départ QA")
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo().performTextReplacement("Autre départ")
        compose.runOnIdle {
            assertNull(current.origin)
            assertNotNull(current.destination)
            assertTrue(current.matches.isEmpty())
        }
        compose.onNodeWithText("Adresse Départ QA").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).assertTextEquals("Autre départ")
        hideKeyboard()
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo()
        captureLocalUi(compose, "local-search-edited-place.png")
    }

    @Test fun aNewSessionCannotReceiveThePreviousSearchStateOrPendingCallbacks() {
        val suggestions = CompletableDeferred<List<PlaceSuggestion>>()
        val booking = CompletableDeferred<String>()
        var suggestionsStarted = false
        var bookingStarted = false
        val gateway = object : FirebaseGateway by gateway() {
            override suspend fun suggestPlaces(input: String) = if (input == "deferred")
                withContext(NonCancellable) { suggestionsStarted = true; suggestions.await() } else listOf(PlaceSuggestion(input, input, input, null))
            override suspend fun requestBooking(trip: be.sportgreenmoove.app.data.TripSummary, childId: String?, seats: Int) = withContext(NonCancellable) { bookingStarted = true; booking.await() }
        }
        host(gateway)
        selectPlace(SgmTestTags.SearchOriginInput, "Départ parent QA")
        selectPlace(SgmTestTags.SearchDestinationInput, "Arrivée parent QA")
        compose.onNodeWithText("Suivi enfant").performScrollTo().performClick()
        compose.onNodeWithText("Consentement").performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText(UiFlowFixtures.match.summary.title).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
        compose.waitUntil(10_000) { bookingStarted }
        lateinit var previous: SearchController
        compose.runOnIdle {
            previous = current
            previous.suggestPlaces("deferred", SearchPlaceTarget.Origin)
        }
        compose.waitUntil(10_000) { suggestionsStarted }
        compose.runOnIdle { uid.value = "driver-qa" }
        compose.waitForIdle()
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo().assertTextEquals("")
        compose.onNodeWithTag(SgmTestTags.SearchDestinationInput).assertTextEquals("")
        compose.runOnIdle {
            assertNotSame(previous, current)
            assertNull(previous.origin)
            assertNull(previous.destination)
            callbacks.clear()
            suggestions.complete(listOf(PlaceSuggestion("old", "Ancien lieu", null, null)))
            booking.complete("previous-booking")
        }
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(callbacks.isEmpty())
            assertNull(current.origin)
            assertNull(current.destination)
            assertTrue(current.matches.isEmpty() && current.originSuggestions.isEmpty())
            assertFalse(current.loading || current.hasSearched)
        }
        compose.onNodeWithText(UiFlowFixtures.match.summary.title).assertDoesNotExist()
        hideKeyboard()
        compose.onNodeWithTag(SgmTestTags.SearchOriginInput).performScrollTo().assertIsDisplayed()
        captureLocalUi(compose, "local-search-account-cleared.png")
    }

    private fun host(firebase: FirebaseGateway) {
        val providers = AndroidProviderSet(UnconfiguredAuthGateway(), firebase)
        compose.setSgmUiTestContent {
            view = LocalView.current
            current = rememberSearchController(providers, rememberCoroutineScope(), uid.value,
                { if (it != null) callbacks += "error" }, { callbacks += "notice" }, { callbacks += "loading:$it" })
            SearchRoute(current, if (uid.value == "parent-qa") listOf(UiFlowFixtures.child) else emptyList(), null, {})
        }
    }
    private fun selectPlace(tag: String, label: String) {
        compose.onNodeWithTag(tag).performScrollTo().performTextReplacement(label)
        compose.onNodeWithTag("$tag.suggest").performClick()
        val option = "$tag.option.$label"
        compose.waitUntil(10_000) { compose.onAllNodesWithTag(option).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(option).performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Adresse $label").fetchSemanticsNodes().isNotEmpty() }
    }
    private fun hideKeyboard() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync {
            view.context.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(view.windowToken, 0)
        }
        compose.waitUntil(10_000) {
            var visible = false
            instrumentation.runOnMainSync { visible = ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime()) == true }
            !visible
        }
    }
    private fun gateway() = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
        override suspend fun suggestPlaces(input: String) = listOf(PlaceSuggestion(input, input, input, null))
        override suspend fun resolvePlace(placeId: String) = UiFlowFixtures.origin.copy(placeId = placeId, label = placeId, formattedAddress = "Adresse $placeId")
        override suspend fun searchTripMatches(criteria: TripSearchCriteria) = listOf(UiFlowFixtures.match)
    }
}
