package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.Role
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.TripMatchSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SearchPublicationActionFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun tripSearchAndMonthButtonsExposeNamedButtonActions() {
        var searchOpened = false
        compose.setSgmUiTestContent { TripsScreen(emptyList(), null, 0, {}, { searchOpened = true }, {}, {}) }
        val button = SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)
        for (label in listOf("Mois suivant", "Mois précédent"))
            compose.onNodeWithContentDescription(label).assert(button).performClick()
        compose.onNodeWithContentDescription("Rechercher un trajet").assert(button).performClick()
        assertTrue(searchOpened)
    }

    @Test
    fun searchActionsDispatchSelectedRideData() {
        var searchForm: SearchFormState? = null
        var requestedMatch: TripMatchSummary? = null
        var requestedChildId: String? = null
        val selection = mutableStateOf(defaultSearchForm(UiFlowFixtures.child.id))
        compose.setSgmUiTestContent {
            SearchScreen(
                originInput = UiFlowFixtures.origin.label, destinationInput = UiFlowFixtures.destination.label,
                form = selection.value, onFormChange = { selection.value = it },
                origin = UiFlowFixtures.origin,
                destination = UiFlowFixtures.destination,
                originSuggestions = emptyList(), destinationSuggestions = emptyList(),
                children = listOf(UiFlowFixtures.child), matches = listOf(UiFlowFixtures.match),
                loading = false, error = null, onBack = {},
                onSuggestOrigin = {}, onSuggestDestination = {}, onSelectOrigin = {}, onSelectDestination = {},
                onSearch = { searchForm = selection.value },
                onRequest = { match -> requestedMatch = match; requestedChildId = selection.value.childUserId },
                onOriginChanged = {}, onDestinationChanged = {},
            )
        }
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        assertEquals(false, searchForm?.guardianConsent)
        compose.onNodeWithText("Consentement").performScrollTo().performClick()
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        assertEquals(UiFlowFixtures.child.id, searchForm?.childUserId)
        assertTrue(searchForm?.guardianConsent == true)
        compose.onNodeWithTag(SgmTestTags.BookingRequestAction).performScrollTo().performClick()
        assertEquals(UiFlowFixtures.match.tripId, requestedMatch?.tripId)
        assertEquals(UiFlowFixtures.child.id, requestedChildId)
    }

    @Test
    fun publishSubmitActionCreatesBackendDraft() {
        val firebase = UiFlowFirebaseGateway()
        var published = false
        compose.setSgmUiTestContent {
            PublishScreen(
                role = AppRole.Driver, firebase = firebase, memberClubs = UiFlowFixtures.clubs,
                initialOrigin = UiFlowFixtures.origin, initialDestination = UiFlowFixtures.destination,
                onError = {}, onNotice = {}, onPublished = { published = true },
            )
        }
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishSubmitAction).performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 5_000) { firebase.createdTripDraft != null && published }
        val draft = firebase.createdTripDraft
        assertEquals("club-royal", draft?.clubId)
        assertEquals(UiFlowFixtures.origin.placeId, draft?.origin?.placeId)
        assertEquals(UiFlowFixtures.destination.placeId, draft?.destination?.placeId)
        assertTrue(draft?.supportsChildTracking == true)
    }

    @Test
    fun publishSubmitFailureShowsFriendlyNetworkCopy() {
        val firebase = UiFlowFirebaseGateway().apply { failCreateTripMessage = "network unavailable while creating trip" }
        var error: String? = null
        var published = false
        compose.setSgmUiTestContent {
            PublishScreen(
                role = AppRole.Driver, firebase = firebase, memberClubs = UiFlowFixtures.clubs,
                initialOrigin = UiFlowFixtures.origin, initialDestination = UiFlowFixtures.destination,
                onError = { error = it }, onNotice = {}, onPublished = { published = true },
            )
        }
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishSubmitAction).performScrollTo().performClick()
        compose.waitUntil(timeoutMillis = 5_000) { error != null }
        assertEquals("Connexion réseau indisponible. Vérifiez votre connexion puis réessayez.", error)
        assertTrue(!published)
    }
}
