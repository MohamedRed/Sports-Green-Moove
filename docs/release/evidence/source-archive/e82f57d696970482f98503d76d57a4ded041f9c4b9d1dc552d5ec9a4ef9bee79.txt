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

internal class LocalRideCompletionPeer private constructor(private val app: FirebaseApp, private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions) : Closeable {
    suspend fun complete(rideId: String, bookingId: String, childId: String) {
        val passenger = mapOf("rideSessionId" to rideId, "bookingId" to bookingId, "childId" to childId)
        check(call("markPickup", passenger)["status"] == "pickup")
        check(call("markDropoff", passenger)["status"] == "dropoff")
        check(call("endRide", mapOf("rideSessionId" to rideId, "distanceMeters" to 0, "passengersSharing" to 1))["rideSessionId"] == rideId)
    }
    private suspend fun call(name: String, data: Map<String, Any>): Map<*, *> {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-driver" && auth.currentUser?.uid == "sgm-qa-driver")
        val reply = functions.getHttpsCallable(name).call(data).await().data as Map<*, *>
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-driver")
        return reply
    }
    override fun close() { auth.signOut(); app.delete() }
    companion object {
        suspend fun open(context: Context, session: JSONObject): LocalRideCompletionPeer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && session.getString("projectId") == "demo-sgm-local-qa")
            val options = FirebaseApp.getInstance().options; check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-completion-peer-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099)
                functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString("driver"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-driver")
                return LocalRideCompletionPeer(app, auth, functions)
            } catch (failure: Throwable) { app.delete(); throw failure }
        }
    }
}
