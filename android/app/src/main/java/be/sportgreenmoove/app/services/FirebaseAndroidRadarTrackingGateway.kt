package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.AppRole
import com.google.firebase.auth.FirebaseAuth
import io.radar.sdk.Radar
import io.radar.sdk.RadarTrackingOptions
import io.radar.sdk.RadarTripOptions
import io.radar.sdk.model.RadarEvent
import io.radar.sdk.model.RadarTrip
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import kotlin.coroutines.resume

class FirebaseAndroidRadarTrackingGateway(
    context: Context,
    publishableKey: String,
) : RadarTrackingGateway {
    private val appContext = context.applicationContext
    private val key = publishableKey.trim()
    override val isConfigured: Boolean = key.isNotEmpty()

    init {
        if (isConfigured && !Radar.isInitialized()) {
            Radar.initialize(appContext, key)
        }
    }

    override suspend fun startTripTracking(rideSessionId: String, role: AppRole) {
        require(rideSessionId.isNotBlank()) { "rideSessionId is required." }
        ensureConfigured()
        FirebaseAuth.getInstance().currentUser?.uid?.let { uid ->
            Radar.setUserId(uid)
        }
        Radar.setMetadata(radarMetadata(rideSessionId, role))

        awaitTripResult("démarrage") { callback ->
            Radar.startTrip(
                RadarTripOptions(
                    externalId = rideSessionId,
                    metadata = radarMetadata(rideSessionId, role),
                    mode = Radar.RadarRouteMode.CAR,
                    startTracking = true,
                ),
                RadarTrackingOptions.CONTINUOUS,
                callback,
            )
        }
    }

    override suspend fun stopTripTracking(rideSessionId: String) {
        require(rideSessionId.isNotBlank()) { "rideSessionId is required." }
        ensureConfigured()
        awaitTripResult("arrêt") { callback ->
            Radar.completeTrip(callback)
        }
    }

    private fun ensureConfigured() {
        if (!isConfigured || !Radar.isInitialized()) {
            throw ProviderConfigurationException("Radar Android n'est pas configuré.")
        }
    }
}

private fun radarMetadata(rideSessionId: String, role: AppRole): JSONObject =
    JSONObject()
        .put("rideSessionId", rideSessionId)
        .put("role", role.locationRole())
        .put("source", "nativeSdk")

private suspend fun awaitTripResult(
    actionLabel: String,
    start: (Radar.RadarTripCallback) -> Unit,
) {
    val status = suspendCancellableCoroutine { continuation ->
        start(object : Radar.RadarTripCallback {
            override fun onComplete(
                status: Radar.RadarStatus,
                trip: RadarTrip?,
                events: Array<RadarEvent>?,
            ) {
                if (continuation.isActive) continuation.resume(status)
            }
        })
    }
    if (status != Radar.RadarStatus.SUCCESS) {
        throw ProviderConfigurationException("Radar Android a refusé: $actionLabel (${status.name}).")
    }
}
