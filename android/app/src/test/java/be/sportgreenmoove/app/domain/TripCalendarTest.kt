package be.sportgreenmoove.app.domain

import java.time.YearMonth
import java.time.ZoneId
import java.util.TimeZone
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TripCalendarTest {
    private val brussels = ZoneId.of("Europe/Brussels")

    @Test
    fun filtersByLocalDepartureMonthIncludingYearBoundary() {
        assertTrue(tripFallsInMonth("2026-12-31T23:30:00Z", YearMonth.of(2027, 1), brussels))
        assertFalse(tripFallsInMonth("2026-12-31T23:30:00Z", YearMonth.of(2026, 12), brussels))
        assertTrue(tripFallsInMonth("2026-10-15T10:00:00Z", YearMonth.of(2026, 10), brussels))
        assertFalse(tripFallsInMonth("2026-10-15T10:00:00Z", YearMonth.of(2026, 11), brussels))
    }

    @Test
    fun missingOrInvalidDatesAreNotInvented() {
        assertFalse(tripFallsInMonth(null, YearMonth.of(2026, 10), brussels))
        assertFalse(tripFallsInMonth("invalid", YearMonth.of(2026, 10), brussels))
    }

    @Test
    fun defaultCalendarMonthUsesBelgianDepartureRegardlessOfDeviceZone() {
        val original = TimeZone.getDefault()
        try {
            for (zone in listOf("UTC", "America/Los_Angeles", "Asia/Tokyo")) {
                TimeZone.setDefault(TimeZone.getTimeZone(zone))
                assertTrue(tripFallsInMonth("2026-12-31T23:30:00Z", YearMonth.of(2027, 1)))
                assertFalse(tripFallsInMonth("2026-12-31T23:30:00Z", YearMonth.of(2026, 12)))
            }
        } finally { TimeZone.setDefault(original) }
    }
}
