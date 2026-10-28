package be.sportgreenmoove.app.data

enum class ConversationKind(val sourceType: String) {
    Booking("booking"), RideSession("rideSession");

    companion object {
        fun fromSource(value: String): ConversationKind = entries.single { it.sourceType == value }
    }
}

data class ConversationRef(val kind: ConversationKind, val sourceId: String) {
    init { require(sourceId.isNotBlank() && sourceId.length <= 256 && !sourceId.contains('/')) }
    val key: String get() = "${kind.sourceType}:$sourceId"
}

data class ConversationMessage(
    val id: String,
    val body: String,
    val mine: Boolean,
    val createdAtSeconds: Long,
    val createdAtNanos: Int = 0,
    val needsRead: Boolean = false,
    val requestId: String? = null,
    val authorName: String? = null,
)

data class ConversationPage(val messages: List<ConversationMessage>, val olderCursorId: String?,
    val participantNames: List<String> = emptyList())
