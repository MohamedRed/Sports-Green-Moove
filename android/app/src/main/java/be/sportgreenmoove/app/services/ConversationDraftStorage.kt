package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationRef
import java.util.UUID

internal data class ConversationDraftRecord(val body: String, val requestId: String?) {
    init {
        require(body.length <= 16_384)
        if (requestId != null) {
            require(UUID.fromString(requestId).toString() == requestId)
            require(body.trim().isNotEmpty() && body.trim().length <= 1000)
        }
    }
}

internal interface ConversationDraftStorage {
    fun read(uid: String, ref: ConversationRef): ConversationDraftRecord?
    fun write(uid: String, ref: ConversationRef, record: ConversationDraftRecord?)
}
