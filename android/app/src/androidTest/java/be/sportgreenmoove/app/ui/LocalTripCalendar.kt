package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import be.sportgreenmoove.app.data.TripSummary
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

internal fun selectLocalTripMonth(compose: ComposeTestRule, trip: TripSummary) {
    val target = YearMonth.from(Instant.parse(requireNotNull(trip.departureAtIso)).atZone(ZoneId.systemDefault()))
    val offset = ChronoUnit.MONTHS.between(YearMonth.now(), target).toInt()
    check(offset in 0..1) { "Fresh local fixtures must depart within the current or next month." }
    repeat(offset) { compose.onNodeWithTag("trips.month.next").performClick() }
    compose.onNodeWithText(target.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)).uppercase(Locale.FRENCH)).assertExists()
}
