package be.sportgreenmoove.app.data

enum class GuardianOptionKind(val wire: String) { Children("children"), Clubs("clubs") }
enum class GuardianParentAction(val wire: String) { Request("request"), Withdraw("withdraw") }
enum class GuardianVerificationStatus(val wire: String, val label: String) {
    Requested("requested", "En attente"), Verified("verified", "Parent vérifié"), Refused("refused", "Demande refusée"),
    Revoked("revoked", "Vérification retirée"), Withdrawn("withdrawn", "Demande retirée"),
}
data class GuardianOption(val id: String, val name: String?)
data class GuardianPage<T>(val items: List<T>, val nextCursor: String?)
data class GuardianVerification(
    val id: String, val clubId: String, val childId: String, val parentUserId: String,
    val clubName: String?, val childName: String?, val status: GuardianVerificationStatus?, val revision: Long,
    val allowedActions: List<GuardianParentAction>,
) { val statusLabel get() = status?.label ?: "Aucune demande" }
data class GuardianParentOperation(
    val clubId: String, val childId: String, val parentUserId: String, val action: GuardianParentAction,
    val expectedRevision: Long, val requestId: String,
)
data class GuardianTransitionReceipt(val verificationId: String, val status: GuardianVerificationStatus, val revision: Long)
