package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.domain.BelgianTripZone
import java.time.Instant
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

internal fun selectLocalTripMonth(compose: ComposeTestRule, trip: TripSummary) {
    val target = YearMonth.from(Instant.parse(requireNotNull(trip.departureAtIso)).atZone(BelgianTripZone))
    val current = YearMonth.now(BelgianTripZone)
    check(ChronoUnit.MONTHS.between(current, target) in 0..1) { "Fresh local fixtures must depart within the current or next month." }
    fun label(month: YearMonth) = month.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)).uppercase(Locale.FRENCH)
    val shown = listOf(current, current.plusMonths(1)).single { month ->
        compose.onAllNodesWithText(label(month)).fetchSemanticsNodes().isNotEmpty()
    }
    val offset = ChronoUnit.MONTHS.between(shown, target).toInt()
    if (offset != 0) compose.onNodeWithTag(if (offset > 0) "trips.month.next" else "trips.month.previous").performClick()
    compose.onNodeWithText(label(target)).assertExists()
}
