package be.sportgreenmoove.app.data

enum class TeamEnrollmentOptionKind(val wire: String) { Clubs("clubs"), Teams("teams"), Children("children") }
enum class TeamEnrollmentAction(val wire: String) { Request("request"), Withdraw("withdraw") }
enum class TeamEnrollmentStatus(val wire: String, val label: String) {
    Requested("requested", "En attente"), Approved("approved", "Inscription approuvée"), Refused("refused", "Inscription refusée"),
    Withdrawn("withdrawn", "Inscription retirée"), Revoked("revoked", "Inscription révoquée"),
}
data class TeamEnrollmentView(
    val id: String, val teamId: String, val clubId: String, val teamInstanceId: String,
    val teamName: String?, val subjectId: String, val childId: String?, val subjectName: String?,
    val status: TeamEnrollmentStatus?, val revision: Long, val eligible: Boolean, val allowedActions: List<TeamEnrollmentAction>,
) { val statusLabel get() = status?.label ?: "Aucune demande" }
data class TeamEnrollmentReceipt(val enrollmentId: String, val teamId: String, val teamInstanceId: String,
    val status: TeamEnrollmentStatus, val revision: Long)
