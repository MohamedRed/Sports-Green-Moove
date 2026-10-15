package be.sportgreenmoove.app.services

internal fun bookingRequestPayload(tripId: String, childId: String?, seats: Int): Map<String, Any> {
    require(tripId.isNotBlank()) { "Trip identifier is required" }
    require(childId == null || childId.isNotBlank()) { "Child identifier must not be blank" }
    require(seats in 1..8) { "Booking seats must be between one and eight" }
    return buildMap {
        put("tripId", tripId)
        put("seats", seats)
        childId?.let { put("childId", it) }
    }
}
