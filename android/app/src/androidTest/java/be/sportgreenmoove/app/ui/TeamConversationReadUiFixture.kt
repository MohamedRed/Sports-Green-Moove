package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*

internal class TeamConversationReadUiFixture(val count: Int = 120) : TeamConversationGateway {
    val title = "Équipe U8 Nationaux du club de la Croix Saint-Lambert QA"
    val readIds = mutableSetOf<String>()
    var readAttempts = 0; var failRead = false; var rejectRead = false
    override suspend fun choices(uid: String, clubId: String?, cursor: String?): GuardianPage<TeamChatChoice> {
        check(uid == "parent")
        return GuardianPage(listOf(if (clubId == null) TeamChatChoice("club", "Club QA", null, null)
            else TeamChatChoice("team", title, "a".repeat(64), (count - readIds.size).toLong())), null)
    }
    override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?): TeamConversationPage {
        check(uid == "parent")
        return TeamConversationPage(title, "b".repeat(64), List(count) { index ->
            ConversationMessage("peer-$index", "Message équipe QA $index", false, (200 - index).toLong(),
                authorName = "Conducteur QA", needsRead = "peer-$index" !in readIds)
        }, null)
    }
    override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String = error("No sends in read components")
    override suspend fun markRead(uid: String, target: TeamConversationTarget, accessVersion: String, messageIds: List<String>) {
        check(uid == "parent" && accessVersion == "b".repeat(64)); readAttempts++
        if (rejectRead) throw TeamConversationReadRejectedException(IllegalStateException("Explicit revoked-authority fixture"))
        check(!failRead) { "Explicit unavailable-read fixture" }; readIds.addAll(messageIds)
    }
}
