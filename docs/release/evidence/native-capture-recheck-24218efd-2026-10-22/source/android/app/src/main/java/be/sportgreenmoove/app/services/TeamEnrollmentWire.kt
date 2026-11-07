package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object TeamEnrollmentWire {
    private fun map(value: Any?) = value as? Map<*, *> ?: error("Réponse d’inscription invalide.")
    private fun name(value: Any?): String? = if (value == null) null else (value as? String)?.takeIf {
        it.isNotBlank() && it.length <= 120 && it.none { char -> char.isISOControl() || char in '\u202a'..'\u202e' || char in '\u2066'..'\u2069' }
    } ?: error("Nom d’inscription invalide.")
    private fun revision(value: Any?): Long {
        val number = (value as? Number)?.toDouble() ?: error("Version d’inscription manquante.")
        check(number.isFinite() && number % 1.0 == 0.0 && number in 0.0..9_007_199_254_740_991.0)
        return number.toLong()
    }
    private fun status(value: Any?) = TeamEnrollmentStatus.entries.singleOrNull { it.wire == value }
        ?: error("État d’inscription invalide.")
    fun option(value: Any?): GuardianOption = map(value).let {
        check(it.containsKey("name")); GuardianOption(TripChangeWire.id(it["id"]), name(it["name"]))
    }
    fun view(value: Any?, uid: String, teamId: String, childId: String?): TeamEnrollmentView = map(value).let {
        check(it["teamId"] == teamId && it["subjectKind"] == if (childId == null) "member" else "child")
        check(it["subjectId"] == (childId ?: uid) && it.containsKey("status") && it.containsKey("teamName") && it.containsKey("subjectName"))
        val state = it["status"]?.let(::status); val version = revision(it["revision"])
        check(if (state == null) version == 0L else version > 0)
        val eligible = it["eligible"] as? Boolean ?: error("Droit d’inscription manquant.")
        val actions = (it["allowedActions"] as? List<*>)?.map { value -> TeamEnrollmentAction.entries.singleOrNull { action -> action.wire == value }
            ?: error("Action d’inscription invalide.") } ?: error("Actions d’inscription manquantes.")
        check(actions.distinct().size == actions.size)
        val open = state in listOf(TeamEnrollmentStatus.Requested, TeamEnrollmentStatus.Approved)
        check(actions.all { action -> if (action == TeamEnrollmentAction.Request) eligible && !open else open })
        TeamEnrollmentView(TripChangeWire.hash(it["id"]), teamId, TripChangeWire.id(it["clubId"]), TripChangeWire.hash(it["teamInstanceId"]),
            name(it["teamName"]), TripChangeWire.id(it["subjectId"]), childId, name(it["subjectName"]), state, version, eligible, actions)
    }
    fun receipt(value: Any?, expected: TeamEnrollmentView): TeamEnrollmentReceipt = map(value).let {
        check(it["enrollmentId"] == expected.id && it["teamId"] == expected.teamId && it["teamInstanceId"] == expected.teamInstanceId && it["replayed"] is Boolean)
        val version = revision(it["revision"]); check(version > expected.revision)
        TeamEnrollmentReceipt(expected.id, expected.teamId, expected.teamInstanceId, status(it["status"]), version)
    }
    fun payload(expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): Map<String, Any> {
        check(expected.revision in 0..9_007_199_254_740_990L && action in expected.allowedActions)
        val operation = mapOf("expectedRevision" to expected.revision, "requestId" to TripChangeWire.uuid(requestId))
        return if (action == TeamEnrollmentAction.Request) operation + mapOf("teamId" to TripChangeWire.id(expected.teamId),
            "expectedTeamInstanceId" to TripChangeWire.hash(expected.teamInstanceId), "expectedEnrollmentId" to TripChangeWire.hash(expected.id)) +
            (expected.childId?.let { mapOf("childId" to TripChangeWire.id(it)) } ?: emptyMap())
        else operation + mapOf("enrollmentId" to TripChangeWire.hash(expected.id), "action" to action.wire)
    }
}
