package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TeamConversationTarget

internal const val teamPushAlertTitle = "Nouveau message d’équipe"
internal const val teamPushAlertBody = "Un nouveau message est disponible dans votre équipe."
internal fun teamPushAlertId(value: String) = value.also { require(it.matches(Regex("teamChat_[a-f0-9]{64}"))) }

data class TeamPushOpenRequest(val notificationId: String, val uid: String, val epoch: Long) {
    init { teamPushAlertId(notificationId); teamPushUid(uid); require(epoch in 1..teamPushMaximumRevision) }
    override fun toString() = "TeamPushOpenRequest(private fields redacted)"
}
internal enum class TeamPushAlertPurpose(val wire: String) { Display("display"), Open("open") }
internal data class TeamPushAlertLease(val identity: TeamPushIdentity, val uid: String, val epoch: Long, val revision: Long) {
    init { identity.validate(); teamPushUid(uid); require(epoch in 1..revision && revision in 1..teamPushMaximumRevision) }
    fun payload(notificationId: String, purpose: TeamPushAlertPurpose): Map<String, Any> = mapOf(
        "installationId" to identity.id, "installationSecret" to identity.proof, "revision" to revision,
        "notificationId" to teamPushAlertId(notificationId), "purpose" to purpose.wire)
    override fun toString() = "TeamPushAlertLease(private fields redacted)"
}
internal fun parseTeamPushAlert(raw: Any?, notificationId: String): TeamConversationTarget? {
    teamPushAlertId(notificationId)
    val value = raw as? Map<*, *> ?: error("Invalid team alert response")
    if (value["status"] == "suppressed") { check(value.keys == setOf("status")); return null }
    check(value.keys == setOf("status", "notificationId", "title", "body", "target"))
    check(value["status"] == "available" && value["notificationId"] == notificationId)
    check(value["title"] == teamPushAlertTitle && value["body"] == teamPushAlertBody)
    val target = value["target"] as? Map<*, *> ?: error("Invalid team alert target")
    check(target.keys == setOf("teamId", "expectedTeamInstanceId"))
    return TeamConversationTarget(target["teamId"] as? String ?: error("Invalid team identity"),
        target["expectedTeamInstanceId"] as? String ?: error("Invalid team instance"))
}

interface TeamPushAlertGateway {
    suspend fun open(request: TeamPushOpenRequest): TeamConversationTarget?
}
internal class TeamPushAlertUnavailableException : IllegalStateException("Team alert authority is no longer available")
