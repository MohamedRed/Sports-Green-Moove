package be.sportgreenmoove.app.ui

import java.time.Instant
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit

data class SearchFormState(
    val desiredDepartureAtIso: String,
    val seatsNeeded: Int,
    val baggage: String,
    val returnTrip: Boolean,
    val requireChildTracking: Boolean,
    val guardianConsent: Boolean,
    val childUserId: String?,
)

fun defaultSearchForm(childUserId: String? = null) = SearchFormState(
    Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES).toString(),
    1, "medium", false, true, false, childUserId,
)

internal fun SearchFormState.validationMessage(): String? {
    try { Instant.parse(desiredDepartureAtIso) }
    catch (_: DateTimeParseException) { return "Choisissez une date et une heure de départ valides." }
    if (seatsNeeded !in 1..8 || baggage !in setOf("small", "medium", "large")) return "Vérifiez les options de recherche."
    if (requireChildTracking && childUserId.isNullOrBlank()) return "Choisissez un enfant pour activer le suivi enfant."
    if (!guardianConsent) return if (requireChildTracking) "Votre consentement est nécessaire pour activer le suivi enfant."
        else "Votre consentement est nécessaire avant de rechercher un trajet."
    return null
}

enum class SearchPlaceTarget { Origin, Destination }
