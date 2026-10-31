package be.sportgreenmoove.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import java.time.LocalDate
import java.time.format.DateTimeFormatter

internal fun chooseSearchDeparture(compose: ComposeTestRule, targetIso: String) {
    val target = requireNotNull(SearchDepartureInput.fromIso(targetIso))
    val date = compose.onNodeWithTag(SgmTestTags.SearchDateInput).performScrollTo()
    val current = LocalDate.parse(date.fetchSemanticsNode().config[SemanticsProperties.Text].single().text,
        DateTimeFormatter.ofPattern("dd/MM/yyyy"))
    date.performClick()
    enterNativePickerDate(current, target.date)
    compose.onNodeWithTag(SgmTestTags.SearchDateInput).assertTextEquals(target.dateLabel)
    compose.onNodeWithTag(SgmTestTags.SearchTimeInput).performScrollTo().performClick()
    enterNativePickerTime(target.time)
    compose.onNodeWithTag(SgmTestTags.SearchTimeInput).assertTextEquals(target.timeLabel)
}
