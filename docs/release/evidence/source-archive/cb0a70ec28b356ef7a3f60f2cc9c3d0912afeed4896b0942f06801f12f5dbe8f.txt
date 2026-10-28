package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.data.BookingIntentSnapshot

internal fun bookingRequestPayload(trip: TripSummary, childId: String?, seats: Int): Map<String, Any> {
    require(trip.id.isNotBlank()) { "Trip identifier is required" }
    require(childId == null || childId.isNotBlank()) { "Child identifier must not be blank" }
    require(seats in 1..8) { "Booking seats must be between one and eight" }
    val intent = trip.bookingIntent ?: throw ProviderConfigurationException("Les détails du trajet doivent être actualisés.")
    require(BookingIntentSnapshot.fromCallablePayload(intent.toCallablePayload()) == intent) { "Invalid trip terms" }
    return buildMap {
        put("tripId", trip.id)
        put("seats", seats)
        put("expectedBookingIntent", intent.toCallablePayload())
        childId?.let { put("childId", it) }
    }
}
