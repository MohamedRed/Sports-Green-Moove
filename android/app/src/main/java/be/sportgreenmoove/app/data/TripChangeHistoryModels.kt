package be.sportgreenmoove.app.data

data class TripChangeHistoryEntry(
    val tripId: String, val proposalId: String, val status: TripChangeStatus,
    val createdAt: String, val departureAt: String, val priceCents: Int,
)

data class TripChangeHistoryPage(val tripId: String, val items: List<TripChangeHistoryEntry>, val nextCursor: String?)
