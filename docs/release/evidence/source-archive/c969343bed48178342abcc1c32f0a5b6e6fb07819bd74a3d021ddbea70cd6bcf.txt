package be.sportgreenmoove.app.services

import android.content.Context
import android.os.Build
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
        val location = try {
            locationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
        } catch (_: SecurityException) {
            throw ProviderConfigurationException("Autorisation localisation requise pour le suivi de course.")
        } ?: throw ProviderConfigurationException("Position GPS indisponible pour le suivi de course.")
        requireOwner()
        val update = nativeLocationPayload(rideSessionId, role.locationRole(), location)
        val result = functions.getHttpsCallable("writeLocationBatch").call(mapOf("updates" to listOf(update))).await()
        requireNativeLocationAcknowledgement(result.data, update)
        requireOwner()
        val intent = ActiveRideLocationService.intent(context, rideSessionId, role.locationRole(), ownerUid, authRevision)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
        else context.startService(intent)
    }
}
