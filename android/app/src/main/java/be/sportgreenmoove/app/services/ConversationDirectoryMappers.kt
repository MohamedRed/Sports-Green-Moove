package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationBookingOption
import be.sportgreenmoove.app.data.ConversationBookingPage
import be.sportgreenmoove.app.data.ConversationBookingStatus
import be.sportgreenmoove.app.data.ConversationDirectoryPage
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.data.ConversationPosition
import be.sportgreenmoove.app.data.ConversationRef

private fun invalid(): Nothing = throw ProviderConfigurationException("Données de conversation indisponibles.")
private fun Map<*, *>.requiredText(key: String) = (get(key) as? String)?.takeIf { it.isNotBlank() } ?: invalid()
private fun Map<*, *>.optionalText(key: String): String? {
    if (!containsKey(key)) invalid()
    return if (get(key) == null) null else requiredText(key)
}
private fun Map<*, *>.integer(key: String, min: Long = 0): Long {
    val number = get(key) as? Number ?: invalid()
    val value = number.toLong()
    if (!number.toDouble().isFinite() || value < min || value > 9_007_199_254_740_991L || value.toDouble() != number.toDouble()) invalid()
    return value
}
private fun Map<*, *>.rows(key: String): List<Map<*, *>> = (get(key) as? List<*>)?.map { it as? Map<*, *> ?: invalid() } ?: invalid()
private fun Map<*, *>.reference() = ConversationRef(ConversationKind.fromSource(requiredText("sourceType")), requiredText("sourceId"))
private fun position(row: Map<*, *>, seconds: String, nanos: String): ConversationPosition {
    val nano = row.integer(nanos)
    val second = row.integer(seconds, -62_135_596_800L)
    if (nano > 999_999_999L || second > 253_402_300_799L) invalid()
    return ConversationPosition(second, nano.toInt(), row.requiredText("id"))
}
private fun Map<*, *>.boundary(key: String): ConversationPosition? {
    if (!containsKey(key)) invalid()
    val row = get(key) ?: return null
    return position(row as? Map<*, *> ?: invalid(), "seconds", "nanos")
}

internal fun mapConversationDirectory(data: Map<*, *>): ConversationDirectoryPage {
    val items = data.rows("items").map { row ->
        val id = row.requiredText("id")
        if (!id.matches(Regex("[a-f0-9]{64}"))) invalid()
        ConversationListItem(id, row.reference(), row.requiredText("title"), row.requiredText("preview"),
            row.requiredText("dateLabel"), row.integer("unreadCount"), row.integer("revision", 1),
            position(row, "lastMessageSeconds", "lastMessageNanos"), row.requiredText("departureLabel"),
            row.optionalText("peerLabel"), row.optionalText("childLabel"))
    }
    val excluded = (data["excludedIds"] as? List<*>)?.map { it as? String ?: invalid() } ?: invalid()
    val page = ConversationDirectoryPage(items, data.optionalText("nextCursor"), data.boundary("newest"), data.boundary("oldest"), excluded)
    if (items.map { it.id }.distinct().size != items.size || (page.newest == null) != (page.oldest == null) ||
        (items.isNotEmpty() && page.newest == null) || (page.nextCursor != null && page.oldest == null)) invalid()
    return page
}

internal fun mapConversationBookings(data: Map<*, *>): ConversationBookingPage = ConversationBookingPage(data.rows("items").map { row ->
    val ref = row.reference()
    val status = ConversationBookingStatus.entries.single { it.wire == row.requiredText("bookingStatus") }
    if (ref.kind != ConversationKind.Booking) invalid()
    ConversationBookingOption(ref, row.requiredText("title"), row.requiredText("departureLabel"), status,
        row.optionalText("peerLabel"), row.optionalText("childLabel"))
}, data.optionalText("nextCursor"))
