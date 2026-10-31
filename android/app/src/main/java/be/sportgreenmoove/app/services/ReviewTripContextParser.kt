package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ReviewTripContext
import java.time.OffsetDateTime

internal fun parseReviewTripContext(row: Map<*, *>): ReviewTripContext? {
    check(row.containsKey("tripContext")) { "Missing review trip context state" }
    val raw = row["tripContext"] ?: return null
    val data = raw as? Map<*, *> ?: error("Invalid review trip context")
    check(data.keys == setOf("tripId", "title", "departureAt", "departureLabel"))
    fun field(key: String, max: Int) = (data[key] as? String)?.takeIf { it.isNotBlank() && it.length <= max }
        ?: error("Invalid review trip $key")
    val tripId = field("tripId", 1500)
    check(!tripId.contains('/') && tripId !in setOf(".", ".."))
    val departureAt = field("departureAt", 64)
    check(runCatching { OffsetDateTime.parse(departureAt) }.isSuccess) { "Invalid review departure" }
    return ReviewTripContext(tripId, field("title", 140), departureAt, field("departureLabel", 120))
}
