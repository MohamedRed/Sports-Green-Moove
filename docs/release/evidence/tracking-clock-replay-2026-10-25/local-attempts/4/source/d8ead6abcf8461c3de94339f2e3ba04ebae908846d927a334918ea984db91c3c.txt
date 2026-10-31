package be.sportgreenmoove.app.services

import android.content.Context
import android.os.Build
import android.os.SystemClock
import be.sportgreenmoove.app.data.AppRole
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

internal class FirebaseAndroidNativeLocationStartup(private val context: Context, private val functions: FirebaseFunctions) {
    private val locationClient = LocationServices.getFusedLocationProviderClient(context)

    suspend fun start(rideSessionId: String, role: AppRole) {
        require(role in setOf(AppRole.Driver, AppRole.Child))
        val ownerUid = requireNotNull(FirebaseAuth.getInstance().currentUser?.uid)
        val authRevision = NativeTrackingAuthorization.currentRevision()
        fun requireOwner() = check(FirebaseAuth.getInstance().currentUser?.uid == ownerUid &&
            NativeTrackingAuthorization.currentRevision() == authRevision) { "La session de suivi a changé." }
        val started = SystemClock.elapsedRealtimeNanos()
        val reference = functions.getHttpsCallable("getActiveRide").call(mapOf("rideSessionId" to rideSessionId)).await()
        val received = SystemClock.elapsedRealtimeNanos()
        requireOwner()
        val envelope = reference.data as? Map<*, *>
        val ride = envelope?.get("ride") as? Map<*, *>
        // This endpoint returns only an authorized active ride; its status text is a display label.
        check(ride?.get("rideSessionId") == rideSessionId) { "La course n’est plus active." }
        val clock = try {
            val anchor = NativeServerTimeAnchor.fromResponse(envelope, started, received)
            ActiveRideLocationService.clockFor(ownerUid, rideSessionId, role.locationRole(), authRevision)
                ?.also { it.observe(anchor) } ?: NativeCaptureClock(anchor)
        } catch (_: IllegalArgumentException) {
            throw ProviderConfigurationException("Référence horaire du suivi indisponible. Réessayez.")
        }
        val location = try {
            locationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
        } catch (_: SecurityException) {
            throw ProviderConfigurationException("Autorisation localisation requise pour le suivi de course.")
        } ?: throw ProviderConfigurationException("Position GPS indisponible pour le suivi de course.")
        requireOwner()
        val update = nativeLocationPayload(rideSessionId, role.locationRole(), location, clock)
        val uploadStarted = SystemClock.elapsedRealtimeNanos()
        val result = functions.getHttpsCallable("writeLocationBatch").call(mapOf("updates" to listOf(update))).await()
        val uploadReceived = SystemClock.elapsedRealtimeNanos()
        requireNativeLocationAcknowledgement(result.data, update)
        requireOwner()
        clock.observe(result.data, uploadStarted, uploadReceived)
        val intent = ActiveRideLocationService.intent(context, rideSessionId, role.locationRole(), ownerUid, authRevision, clock.state())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
        else context.startService(intent)
    }
}
