package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object TeamEnrollmentHistoryWire {
    fun item(value: Any?, uid: String): TeamEnrollmentView {
        val map = value as? Map<*, *> ?: error("Réponse de demande invalide.")
        check(map["requesterUserId"] == uid) { "La demande appartient à un autre compte." }
        val teamId = TripChangeWire.id(map["teamId"])
        val childId = when (map["subjectKind"]) {
            "member" -> null
            "child" -> TripChangeWire.id(map["subjectId"])
            else -> error("Profil de demande invalide.")
        }
        val view = TeamEnrollmentWire.view(value, uid, teamId, childId)
        check(view.status != null && view.revision > 0)
        check(view.allowedActions.all { it == TeamEnrollmentAction.Withdraw })
        if (!view.eligible) {
            check(view.subjectName == null)
            if (childId != null && view.status == TeamEnrollmentStatus.Approved) check(view.allowedActions.isEmpty())
        }
        return view
    }
    fun view(value: Any?, uid: String, enrollmentId: String): TeamEnrollmentView = item(value, uid).also {
        check(it.id == TripChangeWire.hash(enrollmentId)) { "La demande consultée a changé." }
    }
}
