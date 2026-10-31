package be.sportgreenmoove.app.domain

import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

private val tripLocale = Locale.forLanguageTag("fr-BE")
private val tripDateFormatter = DateTimeFormatter.ofPattern("EEE dd MMM", tripLocale).withZone(BelgianTripZone)
private val tripTimeFormatter = DateTimeFormatter.ofPattern("HH'h'mm", tripLocale).withZone(BelgianTripZone)

fun tripDateLabel(departure: Instant): String = tripDateFormatter.format(departure).replace(".", "").uppercase(tripLocale)

fun tripTimeLabel(departure: Instant): String = tripTimeFormatter.format(departure)
