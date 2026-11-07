package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidGuardianGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : GuardianVerificationGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during verification")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any>): Any? {
        requireSession(uid)
        val response = functions.getHttpsCallable(name).call(payload).await()
        requireSession(uid)
        return response.data
    }
    override suspend fun guardianOptions(uid: String, kind: GuardianOptionKind, cursor: String?): GuardianPage<GuardianOption> =
        GuardianVerificationWire.page(call(uid, "listGuardianParentOptions", mapOf("kind" to kind.wire) +
            (cursor?.let { mapOf("cursor" to requireNotNull(GuardianVerificationWire.cursor(it))) } ?: emptyMap())), GuardianVerificationWire::option)

    override suspend fun guardianHistory(uid: String, cursor: String?): GuardianPage<GuardianVerification> =
        GuardianVerificationWire.page(call(uid, "listMyGuardianVerifications", cursor?.let { mapOf("cursor" to requireNotNull(GuardianVerificationWire.cursor(it))) }
            ?: emptyMap())) { GuardianVerificationWire.verification(it, uid) }

    override suspend fun guardianView(uid: String, clubId: String, childId: String): GuardianVerification =
        GuardianVerificationWire.verification(call(uid, "getMyGuardianVerification", mapOf("clubId" to TripChangeWire.id(clubId),
            "childId" to TripChangeWire.id(childId))), uid, allowAbsent = true).also { check(it.clubId == clubId && it.childId == childId) }

    override suspend fun transitionGuardian(request: GuardianParentOperation): GuardianTransitionReceipt {
        val uid = request.parentUserId
        val before = guardianView(uid, request.clubId, request.childId)
        check(before.revision == request.expectedRevision && request.action in before.allowedActions) { "La demande a changé. Actualisez." }
        return GuardianVerificationWire.receipt(call(uid, "transitionGuardianVerification", GuardianVerificationWire.payload(request)),
            before.id, request.expectedRevision)
    }
}
