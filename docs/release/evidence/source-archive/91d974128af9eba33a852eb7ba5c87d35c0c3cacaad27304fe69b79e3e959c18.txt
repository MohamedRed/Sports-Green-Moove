package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.data.ReservationPage

internal fun reservationPage(payload: Any?): ReservationPage {
    fun invalid(): Nothing = throw ProviderConfigurationException("Réponse des réservations invalide.")
    val page = payload as? Map<*, *> ?: invalid()
    val raw = page["items"] as? List<*> ?: invalid()
    val cursor = page["nextCursor"]
    if (!page.containsKey("nextCursor") || (cursor != null && (cursor !is String || cursor.isBlank()))) invalid()
    val items = raw.map { value ->
        val row = value as? Map<*, *> ?: invalid()
        fun text(key: String) = (row[key] as? String)?.takeIf { it.isNotBlank() } ?: invalid()
        fun optional(key: String): String? {
            val result = row[key]
            if (result != null && result !is String) invalid()
            return result
        }
        val count = row["seats"] as? Number ?: invalid()
        val seats = count.toInt()
        if (seats !in 1..8 || count.toDouble() != seats.toDouble()) invalid()
        val status = text("status")
        if (status !in setOf("requested", "approved", "declined", "cancelled", "completed")) invalid()
        val actions = (row["allowedActions"] as? List<*>)?.map { action ->
            ReservationDecision.entries.singleOrNull { it.wire == action } ?: invalid()
        } ?: invalid()
        val refundPending = row["refundPending"] as? Boolean ?: invalid()
        ReservationItem(BookingRequestSummary(text("bookingId"), text("tripId"), text("parentUserId"),
            optional("childId"), optional("childLabel"), seats, optional("note"), status, text("title"),
            text("club"), text("dateLabel"), text("timeLabel"), text("priceLabel")), actions.toSet(), refundPending,
            row["tripChangeId"]?.let(TripChangeWire::hash))
    }
    if (items.map { it.booking.bookingId }.distinct().size != items.size) invalid()
    return ReservationPage(items, cursor)
}
