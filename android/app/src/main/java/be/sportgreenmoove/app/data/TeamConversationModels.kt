package be.sportgreenmoove.app.data

data class TeamConversationTarget(val teamId: String, val teamInstanceId: String) {
    init {
        require(teamId.isNotBlank() && teamId.length <= 256 && '/' !in teamId && teamId !in setOf(".", ".."))
        require(Regex("[a-f0-9]{64}").matches(teamInstanceId))
    }
    val key: String get() = "$teamId:$teamInstanceId"
}

data class TeamChatChoice(val id: String, val name: String?, val teamInstanceId: String?)
data class TeamConversationPage(val title: String?, val accessVersion: String,
    val messages: List<ConversationMessage>, val olderCursor: String?)
