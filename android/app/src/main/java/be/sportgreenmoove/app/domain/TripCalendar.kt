package be.sportgreenmoove.app.domain

import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId

fun tripFallsInMonth(departureAtIso: String?, month: YearMonth, zone: ZoneId = ZoneId.systemDefault()): Boolean =
    departureAtIso?.let { value ->
        runCatching { YearMonth.from(Instant.parse(value).atZone(zone)) == month }.getOrDefault(false)
    } ?: false
