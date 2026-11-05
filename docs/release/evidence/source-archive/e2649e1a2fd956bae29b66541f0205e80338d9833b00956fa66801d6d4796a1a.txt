package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripPublishDraft
import java.util.Locale

fun createTripPublishDraft(
    category: String,
    departureIso: String,
    origin: ResolvedPlace?,
    destination: ResolvedPlace?,
    seats: Int,
    price: String,
    returnTrip: Boolean,
    childTracking: Boolean,
    club: ClubSummary,
): TripPublishDraft? {
    if (origin == null || destination == null) return null
    val priceCents = publicationPriceCents(price) ?: return null
    return TripPublishDraft(
        title = "$category · ${club.name}",
        sport = club.sport,
        clubName = club.name,
        teamName = category,
        clubId = club.id,
        teamId = "${club.id}-${slug(category)}",
        category = category,
        departureAtIso = departureIso,
        origin = origin,
        destination = destination,
        pickupRadiusM = 1500,
        seatsTotal = seats,
        seatsAvailable = seats,
        baggage = "medium",
        returnTrip = returnTrip,
        priceCents = priceCents,
        supportsVehicleTracking = true,
        supportsChildTracking = childTracking,
        co2SavedKgEstimate = 4.2,
    )
}

private fun slug(value: String): String =
    value.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "-").trim('-')
