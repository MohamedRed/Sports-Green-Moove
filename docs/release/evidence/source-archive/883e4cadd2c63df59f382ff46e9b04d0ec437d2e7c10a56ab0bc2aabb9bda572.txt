package be.sportgreenmoove.app.domain

import java.math.BigDecimal
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

fun tripChangePriceCents(value: String): Int? {
    val text = value.trim()
    if (!Regex("^(0|[1-9][0-9]{0,3})([,.][0-9]{1,2})?$").matches(text)) return null
    return runCatching { BigDecimal(text.replace(',', '.')).movePointRight(2).intValueExact() }
        .getOrNull()?.takeIf { it in 0..100_000 }
}

fun sameTripChangeInstant(first: String?, second: String?): Boolean =
    if (first == null || second == null) first == second else Instant.parse(first) == Instant.parse(second)
