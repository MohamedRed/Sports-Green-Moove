package be.sportgreenmoove.app.ui

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime
import java.util.TimeZone

class SearchDepartureInputTest {
    @Test fun winterLabelsUseBelgianLocalTimeWithoutLeakingWireSyntax() {
        val input = requireNotNull(SearchDepartureInput.fromIso("2026-11-01T16:30:00Z"))
        assertEquals("01/11/2026", input.dateLabel)
        assertEquals("17:30 · Bruxelles", input.timeLabel)
        assertEquals("2026-11-01T16:30:00Z", input.toIso())
    }
    @Test fun summerLabelsUseTheSameZoneAsTheTripList() {
        val input = requireNotNull(SearchDepartureInput.fromIso("2026-07-01T16:30:00Z"))
        assertEquals("18:30 · Bruxelles", input.timeLabel)
        assertEquals("2026-07-01T16:30:00Z", input.toIso())
    }
    @Test fun dateCanCrossMidnightInBelgium() {
        val input = requireNotNull(SearchDepartureInput.fromIso("2026-10-31T23:30:00Z"))
        assertEquals("01/11/2026", input.dateLabel)
        assertEquals("00:30 · Bruxelles", input.timeLabel)
    }
    @Test fun phoneTimezoneDoesNotChangeTheSearchCriteria() {
        val original = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
            val input = requireNotNull(SearchDepartureInput.fromIso("2026-11-01T16:30:00Z"))
            assertEquals("17:30 · Bruxelles", input.timeLabel)
            assertEquals("2026-11-01T16:30:00Z", input.toIso())
        } finally { TimeZone.setDefault(original) }
    }
    @Test fun aMissingSpringHourNeverSelectsAnImplicitReplacement() {
        assertNull(SearchDepartureInput(LocalDate.of(2027, 3, 28), LocalTime.of(2, 30)).toIso())
    }
    @Test fun aRepeatedAutumnHourDoesNotSilentlyChooseAnOffset() {
        assertNull(SearchDepartureInput(LocalDate.of(2027, 10, 31), LocalTime.of(2, 30)).toIso())
    }
    @Test fun bothExplicitInstantsOfARepeatedHourRemainReadable() {
        for (value in listOf("2027-10-31T00:30:00Z", "2027-10-31T01:30:00Z"))
            assertEquals("02:30 · Bruxelles", requireNotNull(SearchDepartureInput.fromIso(value)).timeLabel)
    }
    @Test fun validLeapDayAndMonthBoundaryRemainExact() {
        val input = SearchDepartureInput(LocalDate.of(2028, 2, 29), LocalTime.of(23, 45))
        assertEquals("2028-02-29T22:45:00Z", input.toIso())
        assertEquals("2028-03-01T22:45:00Z", input.copy(date = input.date.plusDays(1)).toIso())
    }
    @Test fun invalidWireDatesAreExplicitlyUnavailableNotReplacedWithNow() {
        for (value in listOf("", "not-a-date", "2026-02-30T10:00:00Z", "2026-11-01T16:30", "2026-11-01"))
            assertNull(SearchDepartureInput.fromIso(value))
    }
    @Test fun selectingOnlyTheDatePreservesTheOriginalClockPrecision() {
        val input = requireNotNull(SearchDepartureInput.fromIso("2026-11-01T16:30:12.123Z"))
        assertEquals("2026-11-02T16:30:12.123Z", input.copy(date = input.date.plusDays(1)).toIso())
    }
}
