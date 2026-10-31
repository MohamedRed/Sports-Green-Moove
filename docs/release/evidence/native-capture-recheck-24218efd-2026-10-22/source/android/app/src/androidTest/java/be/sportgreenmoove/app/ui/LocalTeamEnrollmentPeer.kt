package be.sportgreenmoove.app.ui

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.Closeable
import java.util.UUID

internal class LocalTeamEnrollmentPeer private constructor(private val app: FirebaseApp, private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions) : Closeable {
    suspend fun decide(subjectId: String, action: String) {
        requireAccounts(); check(action in setOf("approve", "refuse", "revoke"))
        val page = functions.getHttpsCallable("listTeamEnrollments").call(mapOf("teamId" to "sgm-qa-team-ui-team")).await().data as Map<*, *>
        val row = (page["items"] as List<*>).map { it as Map<*, *> }.single { it["subjectId"] == subjectId }
        check(action in row["allowedActions"] as List<*>)
        val result = functions.getHttpsCallable("transitionTeamEnrollment").call(mapOf("enrollmentId" to row["id"],
            "action" to action, "expectedRevision" to row["revision"], "requestId" to UUID.randomUUID().toString())).await().data as Map<*, *>
        check(result["enrollmentId"] == row["id"] && result["teamInstanceId"] == row["teamInstanceId"])
        check(result["status"] == when (action) { "approve" -> "approved"; "refuse" -> "refused"; else -> "revoked" })
    }
    suspend fun revokeGuardian(): String {
        requireAccounts()
        val page = functions.getHttpsCallable("listClubGuardianVerifications").call(mapOf("clubId" to "sgm-qa-team-ui-club")).await().data as Map<*, *>
        val row = (page["items"] as List<*>).map { it as Map<*, *> }.single {
            it["childId"] == "sgm-qa-team-ui-child" && it["parentUserId"] == "sgm-qa-parent" }
        check("revoke" in row["allowedActions"] as List<*>)
        val requestId = UUID.randomUUID().toString()
        val reply = functions.getHttpsCallable("transitionGuardianVerification").call(mapOf("clubId" to "sgm-qa-team-ui-club",
            "childId" to "sgm-qa-team-ui-child", "parentUserId" to "sgm-qa-parent", "action" to "revoke",
            "expectedRevision" to row["revision"], "requestId" to requestId)).await().data as Map<*, *>
        check(reply["verificationId"] == row["id"] && reply["status"] == "revoked"); return requestId
    }
    private fun requireAccounts() {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent" && auth.currentUser?.uid == "sgm-qa-club-manager")
    }
    override fun close() { auth.signOut(); app.delete() }
    companion object {
        suspend fun open(context: Context, session: JSONObject): LocalTeamEnrollmentPeer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && session.getString("projectId") == "demo-sgm-local-qa")
            val options = FirebaseApp.getInstance().options; check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-team-peer-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099); functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString("manager"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-club-manager"); return LocalTeamEnrollmentPeer(app, auth, functions)
            } catch (failure: Throwable) { app.delete(); throw failure }
        }
    }
}
