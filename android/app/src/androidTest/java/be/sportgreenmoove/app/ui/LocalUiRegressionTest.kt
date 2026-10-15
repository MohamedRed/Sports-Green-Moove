package be.sportgreenmoove.app.ui

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import java.time.YearMonth

class LocalUiRegressionTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun calendarFiltersTripsAndNavigatesAcrossMonths() {
        val month = YearMonth.now()
        val now = UiFlowFixtures.trip.copy(title = "Current month", departureAtIso = month.atDay(15).atTime(12, 0).atZone(java.time.ZoneId.systemDefault()).toInstant().toString())
        val next = now.copy(id = "next-month", title = "Next month", departureAtIso = month.plusMonths(1).atDay(15).atTime(12, 0).atZone(java.time.ZoneId.systemDefault()).toInstant().toString())
        compose.setSgmUiTestContent {
            TripsScreen(listOf(now, next), null, emptyList(), {}, {}, {}, {})
        }
        compose.onNodeWithText("Current month").assertIsDisplayed()
        compose.onNodeWithText("Next month").assertDoesNotExist()
        compose.onNodeWithTag("trips.month.next").performClick()
        compose.onNodeWithText("Next month").assertIsDisplayed()
        compose.onNodeWithText("Current month").assertDoesNotExist()
        compose.onNodeWithTag("trips.month.previous").performClick()
        compose.onNodeWithText("Current month").assertIsDisplayed()
    }

    @Test
    fun emptySearchDistinguishesInitialAndCompletedSearchWithUnselectedConsent() {
        val searched = mutableStateOf(false)
        var submitted: SearchFormState? = null
        val selection = mutableStateOf(defaultSearchForm(UiFlowFixtures.child.id))
        compose.setSgmUiTestContent {
            SearchScreen(originInput = UiFlowFixtures.origin.label, destinationInput = UiFlowFixtures.destination.label,
                form = selection.value, onFormChange = { selection.value = it },
                origin = UiFlowFixtures.origin, destination = UiFlowFixtures.destination,
                originSuggestions = emptyList(), destinationSuggestions = emptyList(),
                children = listOf(UiFlowFixtures.child), matches = emptyList(), loading = false, error = null,
                onBack = {}, onSuggestOrigin = {}, onSuggestDestination = {}, onSelectOrigin = {}, onSelectDestination = {},
                onSearch = { submitted = selection.value }, onRequest = {}, onOriginChanged = {}, onDestinationChanged = {},
                hasSearched = searched.value)
        }
        compose.onNodeWithText("Aucun trajet trouvé.").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.SearchAction).performScrollTo().performClick()
        compose.runOnIdle { assertFalse(requireNotNull(submitted).guardianConsent); searched.value = true }
        compose.onNodeWithText("Aucun trajet trouvé.").performScrollTo().assertIsDisplayed()
        captureLocalUi(compose, "local-search-empty.png")
    }
}
