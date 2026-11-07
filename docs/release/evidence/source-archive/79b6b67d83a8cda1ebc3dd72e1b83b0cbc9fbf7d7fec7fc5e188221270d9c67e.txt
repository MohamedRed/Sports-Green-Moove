package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.domain.BelgianTripZone
import be.sportgreenmoove.app.domain.tripChangeInstant
import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

internal data class SearchDepartureInput(val date: LocalDate, val time: LocalTime) {
    val dateLabel: String get() = date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT))
    val timeLabel: String get() = time.format(DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)) + " · Bruxelles"
    fun toIso(): String? = tripChangeInstant(date, time)

    companion object {
        fun fromIso(value: String): SearchDepartureInput? = try {
            val local = Instant.parse(value).atZone(BelgianTripZone)
            SearchDepartureInput(local.toLocalDate(), local.toLocalTime())
        } catch (_: DateTimeException) { null }
    }
}
