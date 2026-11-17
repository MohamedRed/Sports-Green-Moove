package be.sportgreenmoove.app.services

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

internal class AccountBoundTeamPushRegistration(private val currentUid: () -> String?,
    private val call: suspend (Map<String, Any?>) -> Any?) {
    suspend fun register(command: TeamPushCommand): TeamPushReceipt {
        command.validate()
        if (currentUid() != command.uid) throw CancellationException("Team phone account changed")
        val response = call(command.payload())
        if (currentUid() != command.uid) throw CancellationException("Team phone account changed")
        return parseTeamPushReceipt(response, command)
    }
}
internal class FirebaseAndroidTeamPushRegistration(
    auth: FirebaseAuth = FirebaseAuth.getInstance(), functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
) {
    private val gateway = AccountBoundTeamPushRegistration({ auth.currentUser?.uid }) { payload ->
        functions.getHttpsCallable("registerTeamPushDevice").call(payload).await().data
    }
    suspend fun register(command: TeamPushCommand): TeamPushReceipt = gateway.register(command)
}
internal fun parseTeamPushReceipt(raw: Any?, command: TeamPushCommand): TeamPushReceipt {
    val value = raw as? Map<*, *> ?: error("Invalid phone registration response")
    check(value.keys == setOf("currentUserId", "revision", "active", "reused") && value["currentUserId"] == command.uid)
    val revision = value["revision"] as? Number ?: error("Invalid phone registration revision")
    check(revision.toDouble().isFinite() && revision.toDouble() == revision.toLong().toDouble() && revision.toLong() == command.revision)
    val active = value["active"] as? Boolean ?: error("Invalid phone registration status")
    check(active == (command.token != null))
    return TeamPushReceipt(command.uid, command.revision, active, value["reused"] as? Boolean ?: error("Invalid phone registration replay state"))
}
