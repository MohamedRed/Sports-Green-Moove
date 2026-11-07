package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TeamConversationTarget
import java.util.UUID

internal data class TeamConversationDraftRecord(val body: String, val requestId: String?) {
    init {
        require(body.length <= 16_384)
        if (requestId != null) {
            require(UUID.fromString(requestId).toString() == requestId)
            require(body.trim().isNotEmpty() && body.trim().length <= 1000)
        }
    }
}

internal interface TeamConversationDraftStorage {
    fun read(uid: String, target: TeamConversationTarget): TeamConversationDraftRecord?
    fun write(uid: String, target: TeamConversationTarget, record: TeamConversationDraftRecord?)
}
