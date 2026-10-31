package be.sportgreenmoove.app.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidChildAccountLinkGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : ChildAccountLinkGateway {
    private fun requireSession(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Account changed during child account approval")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any?>): Map<*, *> {
        requireSession(uid)
        val result = functions.getHttpsCallable(name).call(payload).await()
        requireSession(uid)
        return result.data as? Map<*, *> ?: error("Invalid child account approval response")
    }
    override suspend fun createCode(uid: String): ChildAccountLinkCode {
        val value = call(uid, "createChildAccountLinkCode", emptyMap())
        val code = value["code"] as? String ?: error("Missing approval code")
        val expiry = value["expiresAtMillis"] as? Number ?: error("Missing approval expiry")
        check(value["accountUserId"] == uid && Regex("[a-f0-9]{32}").matches(code))
        check(expiry.toDouble().isFinite() && expiry.toDouble() == expiry.toLong().toDouble() && expiry.toLong() > 0)
        return ChildAccountLinkCode(uid, code, expiry.toLong())
    }
    override suspend fun approve(uid: String, target: ChildAccountLinkTarget, code: String): ChildAccountLinkReceipt {
        check(Regex("[a-f0-9]{32}").matches(code))
        val value = call(uid, "approveChildAccountLink", mapOf("code" to code, "childId" to TripChangeWire.id(target.childId),
            "clubId" to TripChangeWire.id(target.clubId), "expectedChildInstanceId" to target.childInstanceId))
        val account = value["accountUserId"] as? String ?: error("Missing child account identity")
        check(account != uid && account.isNotBlank() && !account.contains('/'))
        check(value["childId"] == target.childId && value["childInstanceId"] == target.childInstanceId && value["replayed"] is Boolean)
        return ChildAccountLinkReceipt(account, target.childId, target.childInstanceId)
    }
}
