package be.sportgreenmoove.app.ui

import android.content.Context
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.util.UUID
import java.io.Closeable

internal class LocalMembershipReviewer private constructor(
    private val app: FirebaseApp,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions,
) : Closeable {
    suspend fun review(clubId: String, decision: String) {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent")
        check(auth.currentUser?.uid == "sgm-qa-club-manager")
        check(clubId in listOf("sgm-qa-native-approve", "sgm-qa-native-reject"))
        check(decision in listOf("approve", "reject"))
        val page = functions.getHttpsCallable("listClubMemberships").call(mapOf("clubId" to clubId)).await().data as Map<*, *>
        val id = "sgm-qa-parent_$clubId"
        val membership = (page["items"] as List<*>).map { it as Map<*, *> }.single { it["id"] == id }
        check(membership["status"] == "requested")
        val response = functions.getHttpsCallable("reviewClubMembership").call(mapOf("membershipId" to id,
            "decision" to decision, "expectedVersion" to membership["requestVersion"])).await().data as Map<*, *>
        check(response["membershipId"] == id)
        check(response["status"] == if (decision == "approve") "active" else "rejected")
    }

    override fun close() {
        auth.signOut()
        app.delete()
    }

    companion object {
        suspend fun open(context: Context, session: JSONObject): LocalMembershipReviewer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
            check(session.getString("projectId") == "demo-sgm-local-qa")
            val options = FirebaseApp.getInstance().options
            check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-membership-peer-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app)
                val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
                functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString("manager"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-club-manager")
                return LocalMembershipReviewer(app, auth, functions)
            } catch (failure: Throwable) {
                app.delete()
                throw failure
            }
        }
    }
}
