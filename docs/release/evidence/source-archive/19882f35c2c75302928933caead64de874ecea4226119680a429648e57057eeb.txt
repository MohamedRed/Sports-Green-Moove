package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object GuardianVerificationWire {
    private fun map(value: Any?) = value as? Map<*, *> ?: error("Réponse de vérification invalide.")
    fun cursor(value: Any?): String? = MembershipPageToken.decode(value)
    private fun name(value: Any?): String? = if (value == null) null else (value as? String)?.takeIf { it.isNotBlank() }
        ?: error("Identité de vérification invalide.")
    private fun revision(value: Any?): Long {
        val number = (value as? Number)?.toDouble() ?: error("Version de vérification manquante.")
        check(number.isFinite() && number % 1.0 == 0.0 && number in 0.0..9_007_199_254_740_991.0)
        return number.toLong()
    }
    private fun status(value: Any?) = GuardianVerificationStatus.entries.singleOrNull { it.wire == value }
        ?: error("État de vérification invalide.")
    fun <T> page(value: Any?, decode: (Any?) -> T): GuardianPage<T> = map(value).let { payload ->
        check(payload.containsKey("nextCursor"))
        val items = payload["items"] as? List<*> ?: error("Page de vérifications invalide.")
        check(items.size <= 20)
        GuardianPage(items.map(decode), cursor(payload["nextCursor"]))
    }
    fun option(value: Any?): GuardianOption = map(value).let {
        check(it.containsKey("name")); GuardianOption(TripChangeWire.id(it["id"]), name(it["name"]))
    }
    fun verification(value: Any?, uid: String, allowAbsent: Boolean = false): GuardianVerification = map(value).let {
        check(it["parentUserId"] == uid && it.containsKey("status") && it.containsKey("clubName") && it.containsKey("childName"))
        val state = it["status"]?.let(::status)
        val version = revision(it["revision"])
        check(if (state == null) allowAbsent && version == 0L else version > 0)
        val actions = (it["allowedActions"] as? List<*>)?.map { value ->
            GuardianParentAction.entries.singleOrNull { action -> action.wire == value } ?: error("Action de vérification invalide.")
        } ?: error("Actions de vérification manquantes.")
        check(actions.distinct().size == actions.size)
        val open = state in listOf(GuardianVerificationStatus.Requested, GuardianVerificationStatus.Verified)
        check(actions.all { action -> if (open) action == GuardianParentAction.Withdraw else action == GuardianParentAction.Request })
        GuardianVerification(TripChangeWire.hash(it["id"]), TripChangeWire.id(it["clubId"]), TripChangeWire.id(it["childId"]), uid,
            name(it["clubName"]), name(it["childName"]), state, version, actions)
    }
    fun receipt(value: Any?, expectedId: String, minimumRevision: Long): GuardianTransitionReceipt = map(value).let {
        check(it["verificationId"] == expectedId && it["replayed"] is Boolean)
        val version = revision(it["revision"]); check(version > minimumRevision)
        GuardianTransitionReceipt(expectedId, status(it["status"]), version)
    }
    fun payload(request: GuardianParentOperation): Map<String, Any> {
        check(request.expectedRevision in 0..9_007_199_254_740_990L)
        return mapOf("clubId" to TripChangeWire.id(request.clubId), "childId" to TripChangeWire.id(request.childId),
            "parentUserId" to TripChangeWire.id(request.parentUserId), "action" to request.action.wire,
            "expectedRevision" to request.expectedRevision, "requestId" to TripChangeWire.uuid(request.requestId))
    }
}
