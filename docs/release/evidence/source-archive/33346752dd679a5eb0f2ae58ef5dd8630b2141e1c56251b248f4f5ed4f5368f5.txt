package be.sportgreenmoove.app.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidChildInvitationGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ChildInvitationGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during invitation")
    }
    private fun target(value: ChildAccountLinkTarget) = mapOf("childId" to TripChangeWire.id(value.childId),
        "clubId" to TripChangeWire.id(value.clubId), "expectedChildInstanceId" to value.childInstanceId)
    private suspend fun call(uid: String, name: String, payload: Map<String, Any>): Map<*, *> {
        requireSession(uid)
        val result = functions.getHttpsCallable(name).call(payload).await()
        requireSession(uid)
        return result.data as? Map<*, *> ?: error("Invalid invitation response")
    }
    private fun status(value: Map<*, *>): ChildInvitationStatus {
        val hash = value["invitationHash"] as? String ?: error("Missing invitation fingerprint")
        val status = value["status"] as? String ?: error("Missing invitation status")
        val expiry = value["expiresAtMillis"] as? Number ?: error("Missing invitation expiry")
        check(Regex("[a-f0-9]{64}").matches(hash) && status in setOf("pending", "provisioning", "accepted", "revoked"))
        check(expiry.toDouble().isFinite() && expiry.toDouble() == expiry.toLong().toDouble() && expiry.toLong() > 0)
        return ChildInvitationStatus(hash, status, expiry.toLong())
    }
    override suspend fun current(uid: String, target: ChildAccountLinkTarget): ChildInvitationStatus? {
        val value = call(uid, "getChildInvitation", target(target))
        check(value.containsKey("current"))
        return value["current"]?.let { status(it as? Map<*, *> ?: error("Invalid invitation status")) }
    }
    override suspend fun create(uid: String, target: ChildAccountLinkTarget): ChildInvitationLink {
        val value = call(uid, "createChildInvitation", target(target))
        val receipt = ChildInvitationLink(value["childId"] as? String ?: error("Missing child identity"),
            value["childInstanceId"] as? String ?: error("Missing child profile identity"),
            value["url"] as? String ?: error("Missing invitation link"), status(value + ("status" to "pending")))
        validateInvitationLink(receipt, target, System.currentTimeMillis())
        return receipt
    }
    override suspend fun revoke(uid: String, target: ChildAccountLinkTarget, invitationHash: String) {
        check(Regex("[a-f0-9]{64}").matches(invitationHash))
        val result = call(uid, "revokeChildInvitation", target(target) + ("invitationHash" to invitationHash))
        check(result["revoked"] == true && result["invitationHash"] == invitationHash)
    }
}
