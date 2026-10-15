package be.sportgreenmoove.app.data

data class ConversationPosition(val seconds: Long, val nanos: Int, val id: String) : Comparable<ConversationPosition> {
    override fun compareTo(other: ConversationPosition): Int = compareValuesBy(this, other,
        { it.seconds }, { it.nanos }, { it.id })
}

data class ConversationContext(val title: String, val tripLabel: String)

data class ConversationListItem(
    val id: String, val ref: ConversationRef, val title: String, val preview: String, val dateLabel: String,
    val unreadCount: Long, val revision: Long, val position: ConversationPosition,
    val tripLabel: String, val peerLabel: String? = null, val childLabel: String? = null,
)

data class ConversationDirectoryPage(
    val items: List<ConversationListItem>, val nextCursor: String?,
    val newest: ConversationPosition?, val oldest: ConversationPosition?, val excludedIds: List<String> = emptyList(),
)

enum class ConversationBookingStatus(val wire: String, val label: String) {
    Requested("requested", "En attente"), Approved("approved", "Acceptée"), Completed("completed", "Terminée"),
    Cancelled("cancelled", "Annulée"), Rejected("rejected", "Refusée");
}

data class ConversationBookingOption(
    val ref: ConversationRef, val title: String, val dateLabel: String, val status: ConversationBookingStatus,
    val peerLabel: String? = null, val childLabel: String? = null,
)

data class ConversationBookingPage(val items: List<ConversationBookingOption>, val nextCursor: String?)
