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

internal class LocalGuardianPeer private constructor(private val app: FirebaseApp, private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions) : Closeable {
    suspend fun decide(action: String) {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent" && auth.currentUser?.uid == "sgm-qa-club-manager")
        check(action in setOf("verify", "refuse", "revoke"))
        val club = "sgm-qa-club-green-wavre"; val child = "sgm-qa-child-lina"
        val page = functions.getHttpsCallable("listClubGuardianVerifications").call(mapOf("clubId" to club)).await().data as Map<*, *>
        val row = (page["items"] as List<*>).map { it as Map<*, *> }.single { it["childId"] == child && it["parentUserId"] == "sgm-qa-parent" }
        check(action in row["allowedActions"] as List<*>)
        val result = functions.getHttpsCallable("transitionGuardianVerification").call(mapOf("clubId" to club, "childId" to child,
            "parentUserId" to "sgm-qa-parent", "expectedRevision" to row["revision"], "action" to action,
            "requestId" to UUID.randomUUID().toString())).await().data as Map<*, *>
        check(result["verificationId"] == row["id"])
        check(result["status"] == when (action) { "verify" -> "verified"; "refuse" -> "refused"; else -> "revoked" })
    }
    override fun close() { auth.signOut(); app.delete() }
    companion object {
        suspend fun open(context: Context, session: JSONObject): LocalGuardianPeer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && session.getString("projectId") == "demo-sgm-local-qa")
            val options = FirebaseApp.getInstance().options; check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-guardian-peer-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099); functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString("manager"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-club-manager"); return LocalGuardianPeer(app, auth, functions)
            } catch (failure: Throwable) { app.delete(); throw failure }
        }
    }
}
