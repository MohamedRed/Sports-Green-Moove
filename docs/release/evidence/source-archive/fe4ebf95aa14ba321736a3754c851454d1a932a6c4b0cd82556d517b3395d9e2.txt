package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

class SearchDepartureFlowTest {
    @get:Rule val compose = createComposeRule()
    private val value = mutableStateOf("2026-11-01T16:30:00Z")
    private val edits = mutableListOf<String>()
    private fun host() = compose.setSgmUiTestContent {
        Column(Modifier.verticalScroll(rememberScrollState())) {
            SearchDepartureField(value.value) { value.value = it; edits += it }
        }
    }
    @Test fun nativeDateAndTimePickersProduceTheExpectedWireInstant() {
        host()
        chooseSearchDeparture(compose, "2026-11-02T18:45:00Z")
        compose.runOnIdle { assertEquals("2026-11-02T18:45:00Z", value.value); assertEquals(2, edits.size) }
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals("02/11/2026")
        compose.onNodeWithTag(SgmTestTags.SearchTimeInput).assertTextEquals("19:45 · Bruxelles")
    }
    @Test fun cancellingEitherNativePickerPreservesTheAcceptedChoiceWithoutAnEdit() {
        host()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).performClick()
        enterNativePickerDate(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2), confirm = false)
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals("01/11/2026")
        compose.onNodeWithTag(SgmTestTags.SearchTimeInput).performClick()
        enterNativePickerTime(LocalTime.of(18, 45), confirm = false)
        compose.onNodeWithTag(SgmTestTags.SearchTimeInput).assertTextEquals("17:30 · Bruxelles")
        compose.runOnIdle { assertTrue(edits.isEmpty()); assertEquals("2026-11-01T16:30:00Z", value.value) }
    }
    @Test fun aMissingLocalHourIsRejectedAndCanBeCorrectedWithoutReplacingTheChoice() {
        value.value = "2027-03-27T01:30:00Z"; host()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).performClick()
        enterNativePickerDate(LocalDate.of(2027, 3, 27), LocalDate.of(2027, 3, 28))
        compose.onNodeWithTag("search.departure.issue").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals("27/03/2027")
        compose.runOnIdle { assertTrue(edits.isEmpty()); assertEquals("2027-03-27T01:30:00Z", value.value) }
        compose.onNodeWithTag(SgmTestTags.SearchTimeInput).performClick()
        enterNativePickerTime(LocalTime.of(4, 45))
        compose.onNodeWithTag("search.departure.issue").assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).performClick()
        enterNativePickerDate(LocalDate.of(2027, 3, 27), LocalDate.of(2027, 3, 28))
        compose.runOnIdle { assertEquals("2027-03-28T02:45:00Z", value.value); assertEquals(2, edits.size) }
    }
    @Test fun aRepeatedLocalHourNeverSilentlyChoosesOneOffset() {
        value.value = "2027-10-30T00:30:00Z"; host()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).performClick()
        enterNativePickerDate(LocalDate.of(2027, 10, 30), LocalDate.of(2027, 10, 31))
        compose.onNodeWithTag("search.departure.issue").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals("30/10/2027")
        compose.runOnIdle { assertTrue(edits.isEmpty()); assertEquals("2027-10-30T00:30:00Z", value.value) }
    }
    @Test fun invalidWireInputIsExplicitAndDoesNotInventAnotherDeparture() {
        value.value = "invalid"; host()
        compose.onNodeWithText("Date de départ invalide.").assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertDoesNotExist()
        compose.onNodeWithTag(SgmTestTags.SearchTimeInput).assertDoesNotExist()
        compose.runOnIdle { assertEquals("invalid", value.value); assertTrue(edits.isEmpty()) }
    }
}
