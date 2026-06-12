package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.BookingRequestSummary

internal fun mapBookingRequest(data: Map<*, *>): BookingRequestSummary? {
    val bookingId = data["bookingId"] as? String ?: return null
    val tripId = data["tripId"] as? String ?: return null
    val seats = (data["seats"] as? Number)?.toInt() ?: 1
    return BookingRequestSummary(
        bookingId = bookingId,
        tripId = tripId,
        parentUserId = data["parentUserId"] as? String ?: "",
        childId = data["childId"] as? String,
        childLabel = data["childLabel"] as? String,
        seats = seats,
        note = data["note"] as? String,
        status = data["status"] as? String ?: "requested",
        title = data["title"] as? String ?: "Trajet sportif",
        club = data["club"] as? String ?: "Club",
        dateLabel = data["dateLabel"] as? String ?: "DATE À CONFIRMER",
        timeLabel = data["timeLabel"] as? String ?: "--h--",
        priceLabel = data["priceLabel"] as? String ?: "Gratuit",
    )
}
