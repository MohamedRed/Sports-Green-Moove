package be.sportgreenmoove.app.data

enum class ReservationDecision(val wire: String, val status: String) {
    Approve("approve", "approved"), Decline("decline", "declined"), Cancel("cancel", "cancelled")
}

data class ReservationItem(
    val booking: BookingRequestSummary,
    val allowedActions: Set<ReservationDecision>,
    val refundPending: Boolean,
)

data class ReservationPage(val items: List<ReservationItem>, val nextCursor: String?)
