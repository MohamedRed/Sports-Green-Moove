package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripStatus
import be.sportgreenmoove.app.data.TripSummary
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

internal fun mapTrip(id: String, data: Map<String, Any>): TripSummary {
    val departure = dateValue(data["departureAt"])
    val seats = (data["seatsAvailable"] as? Number)?.toInt() ?: 0
    val dateLabel = departure?.let(::formatDateLabel) ?: "DATE À CONFIRMER"
    val timeLabel = departure?.let(::formatTimeLabel) ?: "--h--"
    val distanceKm = (data["distanceKm"] as? Number)?.toDouble()

    return TripSummary(
        id = id,
        title = data["title"] as? String ?: "${data["category"] as? String ?: "Trajet"} sportif",
        club = data["clubName"] as? String ?: data["clubId"] as? String ?: "Club",
        category = data["category"] as? String ?: "",
        sport = data["sport"] as? String ?: "Football",
        departureLabel = "${dateLabel.replace(Regex("^[A-ZÀ-ÿ]{3}\\s"), "")} · $timeLabel",
        dateLabel = dateLabel,
        timeLabel = timeLabel,
        distanceLabel = distanceKm?.let { "%.1f km".format(Locale.US, it) } ?: "Distance à confirmer",
        seatsAvailable = seats,
        priceLabel = priceLabel((data["priceCents"] as? Number)?.toInt() ?: 0),
        passengerInitials = (data["passengerInitials"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
        reasons = listOf(
            if (seats > 1) "$seats places" else "$seats place",
            "Suivi véhicule disponible",
        ),
        status = if (departure != null && departure.before(Date())) TripStatus.Past else TripStatus.Upcoming,
        mapPreview = mapRoutePreviewFromTripData(data),
    )
}

internal fun mapRide(data: Map<*, *>): LiveRideSnapshot =
    LiveRideSnapshot(
        rideSessionId = data["rideSessionId"] as? String ?: "",
        tripId = data["tripId"] as? String,
        status = data["status"] as? String ?: "Actif",
        vehicleLastUpdateLabel = data["vehicleLastUpdateLabel"] as? String ?: "En attente du premier point GPS",
        childLastUpdateLabel = data["childLastUpdateLabel"] as? String,
        etaLabel = data["etaLabel"] as? String ?: "ETA à calculer",
        stale = data["stale"] as? Boolean ?: true,
        passengers = (data["passengers"] as? List<*>)
            ?.mapNotNull { it as? Map<*, *> }
            ?.map(::mapRidePassenger)
            .orEmpty(),
    )

private fun mapRidePassenger(data: Map<*, *>): RidePassengerStatus =
    RidePassengerStatus(
        bookingId = data["bookingId"] as? String ?: "",
        childId = data["childId"] as? String ?: "",
        label = data["label"] as? String ?: "Enfant",
        pickupStatus = data["pickupStatus"] as? String ?: "pending",
        dropoffStatus = data["dropoffStatus"] as? String ?: "pending",
    )

private fun dateValue(value: Any?): Date? =
    when (value) {
        is Timestamp -> value.toDate()
        is Date -> value
        is String -> runCatching { Date.from(Instant.parse(value)) }.getOrNull()
        else -> null
    }

private fun formatDateLabel(date: Date): String =
    SimpleDateFormat("EEE dd MMM", BelgianFrenchLocale)
        .format(date)
        .replace(".", "")
        .uppercase(BelgianFrenchLocale)

private fun formatTimeLabel(date: Date): String =
    SimpleDateFormat("HH'h'mm", BelgianFrenchLocale).format(date)

private fun priceLabel(cents: Int): String =
    if (cents == 0) {
        "Gratuit"
    } else {
        "%.2f EUR".format(BelgianFrenchLocale, cents.toDouble() / 100.0)
    }

private val BelgianFrenchLocale: Locale = Locale.Builder()
    .setLanguage("fr")
    .setRegion("BE")
    .build()
