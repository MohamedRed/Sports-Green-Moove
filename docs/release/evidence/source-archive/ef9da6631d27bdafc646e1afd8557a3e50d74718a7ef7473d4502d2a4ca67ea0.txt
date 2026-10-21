package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidTeamConversationGateway(
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : TeamConversationGateway {
    private fun checkAccount(uid: String) {
        if (uid.isBlank() || auth.currentUser?.uid != uid) throw CancellationException("Team conversation account changed")
    }
    private suspend fun call(uid: String, name: String, payload: Map<String, Any>): Any? {
        checkAccount(uid)
        val result = functions.getHttpsCallable(name).call(payload).await().data
        checkAccount(uid); return result
    }
    override suspend fun choices(uid: String, clubId: String?, cursor: String?): GuardianPage<TeamChatChoice> =
        TeamConversationWire.choices(call(uid, "listTeamChatOptions", mapOf("kind" to if (clubId == null) "clubs" else "teams") +
            (clubId?.let { mapOf("clubId" to TripChangeWire.id(it)) } ?: emptyMap()) +
            (cursor?.let { mapOf("cursor" to requireNotNull(MembershipPageToken.decode(it))) } ?: emptyMap())), uid, clubId)

    override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?): TeamConversationPage =
        TeamConversationWire.page(call(uid, "getTeamChatMessages", TeamConversationWire.target(target) +
            (cursor?.let { mapOf("cursor" to requireNotNull(MembershipPageToken.decode(it))) } ?: emptyMap())), uid, target)

    override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String {
        try {
            return TeamConversationWire.receipt(call(uid, "sendTeamChatMessage", TeamConversationWire.target(target) +
                mapOf("body" to body.trim().also { require(it.isNotEmpty() && it.length <= 1000) },
                    "clientMessageId" to TripChangeWire.uuid(requestId))), uid, target)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) {
            val code = (error as? FirebaseFunctionsException)?.code
            throw MessageSendException(code in setOf(FirebaseFunctionsException.Code.INVALID_ARGUMENT,
                FirebaseFunctionsException.Code.PERMISSION_DENIED, FirebaseFunctionsException.Code.UNAUTHENTICATED,
                FirebaseFunctionsException.Code.NOT_FOUND, FirebaseFunctionsException.Code.FAILED_PRECONDITION,
                FirebaseFunctionsException.Code.ALREADY_EXISTS, FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED), error)
        }
    }
}
