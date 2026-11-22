package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidEmergencyContactGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val guardians: GuardianVerificationGateway = FirebaseAndroidGuardianGateway(functions, auth),
) : EmergencyContactGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during contact operation")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any?>): Any? {
        requireSession(uid)
        val result = functions.getHttpsCallable(name).call(payload).await()
        requireSession(uid)
        return result.data
    }
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView {
        val identity = if (target is EmergencyContactTarget.Child) guardians.guardianView(uid, target.clubId, target.childId).also {
            check(it.parentUserId == uid && it.childId == target.childId && it.clubId == target.clubId &&
                it.status == GuardianVerificationStatus.Verified && it.childName != null && it.clubName != null)
        } else null
        return EmergencyContactWire.view(call(uid, "getEmergencyContact", mapOf("target" to EmergencyContactWire.target(target))), uid, target)
            .copy(childName = identity?.childName, clubName = identity?.clubName)
    }
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt =
        EmergencyContactWire.receipt(call(uid, "saveEmergencyContact", EmergencyContactWire.payload(operation)), uid, operation)
}
