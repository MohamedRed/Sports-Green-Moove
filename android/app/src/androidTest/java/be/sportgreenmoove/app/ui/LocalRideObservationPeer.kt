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

internal class LocalRideObservationPeer private constructor(private val app: FirebaseApp, private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions, private val rideId: String) : Closeable {
    val uid: String get() = requireNotNull(auth.currentUser?.uid)
    val operations = mutableMapOf<String, Int>()
    suspend fun point(lat: Double = 50.715, lng: Double = 4.612) {
        val result = call("writeLocationBatch", mapOf("updates" to listOf(mapOf("rideSessionId" to rideId, "role" to "driver",
            "lat" to lat, "lng" to lng, "accuracyM" to 8, "capturedAt" to System.currentTimeMillis()))))
        check((result["written"] as Number).toInt() == 1)
    }
    suspend fun pickup(bookingId: String, childId: String) {
        check(call("markPickup", mapOf("rideSessionId" to rideId, "bookingId" to bookingId, "childId" to childId))["status"] == "pickup")
    }
    suspend fun dropoff(bookingId: String, childId: String) {
        check(call("markDropoff", mapOf("rideSessionId" to rideId, "bookingId" to bookingId, "childId" to childId))["status"] == "dropoff")
    }
    suspend fun complete() {
        check(call("endRide", mapOf("rideSessionId" to rideId, "distanceMeters" to 0, "passengersSharing" to 1))["rideSessionId"] == rideId)
    }
    private suspend fun call(name: String, data: Map<String, Any>): Map<*, *> {
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent" && uid == "sgm-qa-driver")
        val reply = functions.getHttpsCallable(name).call(data).await().data as Map<*, *>
        check(FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent")
        operations[name] = (operations[name] ?: 0) + 1
        return reply
    }
    override fun close() { auth.signOut(); app.delete() }
    companion object {
        suspend fun open(context: Context, session: JSONObject, rideId: String): LocalRideObservationPeer {
            check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && session.getString("projectId") == "demo-sgm-local-qa")
            val options = FirebaseApp.getInstance().options; check(options.projectId == "demo-sgm-local-qa")
            val app = FirebaseApp.initializeApp(context, options, "local-ride-peer-${UUID.randomUUID()}")
            try {
                val auth = FirebaseAuth.getInstance(app); val functions = FirebaseFunctions.getInstance(app)
                auth.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 9099); functions.useEmulator(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001)
                auth.signInWithEmailAndPassword(session.getString("driver"), session.getString("password")).await()
                check(auth.currentUser?.uid == "sgm-qa-driver")
                return LocalRideObservationPeer(app, auth, functions, rideId)
            } catch (failure: Throwable) { app.delete(); throw failure }
        }
    }
}
