package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.GuardianPage
import be.sportgreenmoove.app.data.TeamChatChoice
import be.sportgreenmoove.app.data.TeamConversationPage
import be.sportgreenmoove.app.data.TeamConversationTarget

interface TeamConversationGateway {
    suspend fun choices(uid: String, clubId: String?, cursor: String?): GuardianPage<TeamChatChoice>
    suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String? = null): TeamConversationPage
    suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String
}
