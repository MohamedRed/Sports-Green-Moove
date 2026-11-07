package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal fun tripHistoryPage(value: Any?, tripId: String): TripChangeHistoryPage {
    val data = TripChangeWire.map(value)
    check(data["tripId"] == tripId && data.containsKey("nextCursor"))
    val rows = data["items"] as? List<*> ?: error("Historique invalide.")
    check(rows.size <= 10)
    val items = rows.map { row ->
        val item = TripChangeWire.map(row)
        check(item["tripId"] == tripId)
        TripChangeHistoryEntry(tripId, TripChangeWire.hash(item["proposalId"]),
            TripChangeStatus.entries.single { it.wire == item["status"] },
            TripChangeWire.date(item["createdAt"]), TripChangeWire.date(item["departureAt"]),
            TripChangeWire.integer(item["priceCents"], max = 100_000))
    }
    check(items.map { it.proposalId }.distinct().size == items.size)
    val cursor = data["nextCursor"]?.let {
        (it as? String)?.takeIf { text -> text.length in 1..2048 && Regex("^[A-Za-z0-9_-]+$").matches(text) }
            ?: error("Page d’historique invalide.")
    }
    check(cursor == null || items.isNotEmpty())
    return TripChangeHistoryPage(tripId, items, cursor)
}
