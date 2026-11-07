package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTeamEnrollmentGateway(private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()) : TeamEnrollmentGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during team enrollment")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any>): Any? {
        requireSession(uid); val result = functions.getHttpsCallable(name).call(payload).await(); requireSession(uid); return result.data
    }
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?): GuardianPage<GuardianOption> {
        val context = when (kind) {
            TeamEnrollmentOptionKind.Clubs -> { check(contextId == null); emptyMap() }
            TeamEnrollmentOptionKind.Teams -> mapOf("clubId" to TripChangeWire.id(contextId))
            TeamEnrollmentOptionKind.Children -> mapOf("teamId" to TripChangeWire.id(contextId))
        }
        return GuardianVerificationWire.page(call(uid, "listTeamEnrollmentOptions", mapOf("kind" to kind.wire) + context +
            (cursor?.let { mapOf("cursor" to requireNotNull(GuardianVerificationWire.cursor(it))) } ?: emptyMap())), TeamEnrollmentWire::option)
    }
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView =
        TeamEnrollmentWire.view(call(uid, "getTeamEnrollmentView", mapOf("teamId" to TripChangeWire.id(teamId)) +
            (childId?.let { mapOf("childId" to TripChangeWire.id(it)) } ?: emptyMap())), uid, teamId, childId)

    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt {
        val current = teamEnrollmentView(uid, expected.teamId, expected.childId)
        check(current.id == expected.id && current.clubId == expected.clubId && current.teamInstanceId == expected.teamInstanceId &&
            current.revision == expected.revision && current.status == expected.status && action in current.allowedActions) { "La demande a changé. Actualisez." }
        return TeamEnrollmentWire.receipt(call(uid, if (action == TeamEnrollmentAction.Request) "requestTeamEnrollment" else "transitionTeamEnrollment",
            TeamEnrollmentWire.payload(current, action, requestId)), current)
    }
}
