package be.sportgreenmoove.app.domain

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

val BelgianTripZone: ZoneId = ZoneId.of("Europe/Brussels")

fun tripChangeInstant(date: LocalDate, time: LocalTime): String? {
    val local = LocalDateTime.of(date, time)
    val offsets = BelgianTripZone.rules.getValidOffsets(local)
    return offsets.singleOrNull()?.let { local.toInstant(it).toString() }
}

fun tripChangePriceCents(value: String): Int? = tripPriceCents(value)

fun sameTripChangeInstant(first: String?, second: String?): Boolean =
    if (first == null || second == null) first == second else Instant.parse(first) == Instant.parse(second)
