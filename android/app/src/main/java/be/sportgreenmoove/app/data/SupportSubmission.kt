package be.sportgreenmoove.app.data

import java.util.UUID

data class SupportSubmission(val uid: String, val requestId: String, val reason: String, val description: String,
    val emergency: Boolean, val subjectType: String = "other", val subjectId: String? = null) {
    fun validate() {
        require(uid.isNotBlank() && uid.length <= 128)
        require(UUID.fromString(requestId).toString() == requestId)
        require(reason == reason.trim() && reason.length in 2..120)
        require(description == description.trim() && description.length in 5..2000)
        require(subjectType in setOf("booking", "rideSession", "message", "user", "other"))
        require(subjectId == null || (subjectId == subjectId.trim() && subjectId.length in 1..1500))
    }
    fun payload(): Map<String, Any> {
        validate()
        return buildMap {
            put("requesterUserId", uid); put("clientRequestId", requestId); put("subjectType", subjectType)
            put("reason", reason); put("description", description); put("emergency", emergency)
            subjectId?.let { put("subjectId", it) }
        }
    }
    fun acknowledgedReport(payload: Map<*, *>): String {
        check(payload["clientRequestId"] == requestId && payload["requesterUserId"] == uid && payload["status"] == "open")
        check(payload["reused"] is Boolean)
        return (payload["reportId"] as? String)?.takeIf { it.matches(Regex("[a-f0-9]{64}")) } ?: error("Invalid support receipt")
    }
}
