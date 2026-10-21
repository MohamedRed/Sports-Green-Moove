package be.sportgreenmoove.app.ui

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import be.sportgreenmoove.app.data.TeamConversationTarget
import be.sportgreenmoove.app.services.FirebaseAndroidTeamConversationGateway
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.Closeable
import java.util.UUID

internal class LocalTeamChatPeer private constructor(private val app: FirebaseApp, private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions, private val uid: String, private val fixture: JSONObject) : Closeable {
    private val target = TeamConversationTarget(fixture.getString("teamId"), fixture.getString("teamInstanceId"))
    private val chat = FirebaseAndroidTeamConversationGateway(functions, auth)
    private fun currentParent() {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent" && auth.currentUser?.uid == uid)
    }
    suspend fun send(body: String): String {
        currentParent(); check(uid == "sgm-qa-driver")
        return chat.send(uid, target, body, UUID.randomUUID().toString())
    }
    suspend fun observeParentMessage(body: String): String {
        currentParent(); check(uid == "sgm-qa-driver")
        val row = chat.messages(uid, target).messages.single { it.body == body }
        check(!row.mine); return row.id
    }
    suspend fun revokeParent(): String {
        currentParent(); check(uid == "sgm-qa-club-manager")
        val club = fixture.getString("clubId"); val child = fixture.getString("childId")
        val page = functions.getHttpsCallable("listClubGuardianVerifications").call(mapOf("clubId" to club)).await().data as Map<*, *>
        val row = (page["items"] as List<*>).map { it as Map<*, *> }.single {
            it["childId"] == child && it["parentUserId"] == "sgm-qa-parent" }
        check("revoke" in row["allowedActions"] as List<*>)
        val requestId = UUID.randomUUID().toString()
        val reply = functions.getHttpsCallable("transitionGuardianVerification").call(mapOf("clubId" to club, "childId" to child,
            "parentUserId" to "sgm-qa-parent", "action" to "revoke", "expectedRevision" to row["revision"], "requestId" to requestId)).await().data as Map<*, *>
        check(reply["verificationId"] == row["id"] && reply["status"] == "revoked"); return requestId
    }
    override fun close() { auth.signOut(); app.delete() }
    companion object {
        suspend fun open(context: Context, session: JSONObject, role: String): LocalTeamChatPeer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && session.getString("projectId") == "demo-sgm-local-qa")
            check(role in setOf("driver", "manager"))
            val options = FirebaseApp.getInstance().options; check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-team-chat-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099); functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString(role), session.getString("password")).await()
                val uid = if (role == "driver") "sgm-qa-driver" else "sgm-qa-club-manager"
                check(auth.currentUser?.uid == uid)
                return LocalTeamChatPeer(app, auth, functions, uid, session.getJSONObject("teamChat"))
            } catch (failure: Throwable) { app.delete(); throw failure }
        }
    }
}
