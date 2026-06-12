package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.data.TripSearchCriteria
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import kotlin.math.round

internal fun TripSearchCriteria.toCallablePayload(): Map<String, Any> {
    val payload = mutableMapOf<String, Any>(
        "desiredDepartureAt" to desiredDepartureAtIso,
        "origin" to mapOf("lat" to origin.lat, "lng" to origin.lng),
        "destination" to mapOf("lat" to destination.lat, "lng" to destination.lng),
        "seatsNeeded" to seatsNeeded,
        "baggage" to baggage,
        "returnTrip" to returnTrip,
        "requireChildTracking" to requireChildTracking,
        "guardianConsent" to guardianConsent,
    )
    childUserId?.takeIf(String::isNotBlank)?.let { payload["childUserId"] = it }
    clubId?.takeIf(String::isNotBlank)?.let { payload["clubId"] = it }
    teamId?.takeIf(String::isNotBlank)?.let { payload["teamId"] = it }
    category?.takeIf(String::isNotBlank)?.let { payload["category"] = it }
    return payload
}

internal fun mapPlaceSuggestion(data: Map<*, *>): PlaceSuggestion? {
    val placeId = data["placeId"] as? String ?: return null
    val label = data["label"] as? String ?: return null
    return PlaceSuggestion(
        placeId = placeId,
        label = label,
        mainText = data["mainText"] as? String,
        secondaryText = data["secondaryText"] as? String,
    )
}

internal fun mapResolvedPlace(data: Map<*, *>): ResolvedPlace {
    val location = data["location"] as? Map<*, *> ?: throw ProviderConfigurationException("Coordonnées Place manquantes.")
    val lat = (location["lat"] as? Number)?.toDouble()
    val lng = (location["lng"] as? Number)?.toDouble()
    if (lat == null || lng == null) throw ProviderConfigurationException("Coordonnées Place invalides.")
    return ResolvedPlace(
        placeId = data["placeId"] as? String ?: throw ProviderConfigurationException("Place ID manquant."),
        label = data["label"] as? String ?: data["formattedAddress"] as? String ?: "Adresse",
        formattedAddress = data["formattedAddress"] as? String ?: data["label"] as? String ?: "Adresse",
        lat = lat,
        lng = lng,
    )
}

internal fun mapTripMatch(data: Map<*, *>): TripMatchSummary? {
    val tripId = data["tripId"] as? String ?: return null
    val summary = (data["summary"] as? Map<*, *>)?.let(::mapClientTripSummary) ?: return null
    val route = data["route"] as? Map<*, *>
    val detourSeconds = (route?.get("detourDurationSeconds") as? Number)?.toInt()
    return TripMatchSummary(
        tripId = tripId,
        score = (data["score"] as? Number)?.toDouble() ?: 0.0,
        summary = summary,
        reasons = (data["reasons"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
        detourMinutes = detourSeconds?.let { round(it / 60.0).toInt() },
        pickupDistanceMeters = (route?.get("pickupDistanceMeters") as? Number)?.toInt(),
    )
}

private fun mapClientTripSummary(data: Map<*, *>): TripSummary {
    val seats = (data["seatsAvailable"] as? Number)?.toInt() ?: 0
    return TripSummary(
        id = data["id"] as? String ?: "",
        title = data["title"] as? String ?: "Trajet sportif",
        club = data["club"] as? String ?: "Club",
        category = data["category"] as? String ?: "",
        sport = data["sport"] as? String ?: "Football",
        departureLabel = data["departureLabel"] as? String ?: "Date à confirmer",
        dateLabel = data["dateLabel"] as? String ?: "DATE À CONFIRMER",
        timeLabel = data["timeLabel"] as? String ?: "--h--",
        distanceLabel = data["distanceLabel"] as? String ?: "Distance à confirmer",
        seatsAvailable = seats,
        seatsLabel = data["seatsLabel"] as? String ?: if (seats > 1) "$seats places" else "$seats place",
        priceLabel = data["priceLabel"] as? String ?: "Gratuit",
        passengerInitials = (data["passengerInitials"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
        reasons = (data["reasons"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
        status = when (data["status"] as? String) {
            "past" -> TripStatus.Past
            "pending" -> TripStatus.Pending
            else -> TripStatus.Upcoming
        },
    )
}
