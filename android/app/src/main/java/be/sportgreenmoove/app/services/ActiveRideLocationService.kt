package be.sportgreenmoove.app.services

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import be.sportgreenmoove.app.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ActiveRideLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val functions by lazy { FirebaseFunctions.getInstance() }
    private lateinit var locationClient: FusedLocationProviderClient
    private var activeRideSessionId: String? = null
    private var activeRole: String = ROLE_DRIVER

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val rideSessionId = activeRideSessionId ?: return
            val locations = result.locations
            if (locations.isEmpty()) return
            scope.launch {
                runCatching {
                    uploadBatch(rideSessionId = rideSessionId, role = activeRole, locations = locations)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationClient = LocationServices.getFusedLocationProviderClient(this)
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val rideSessionId = intent?.getStringExtra(EXTRA_RIDE_SESSION_ID)
        if (rideSessionId.isNullOrBlank()) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        activeRideSessionId = rideSessionId
        activeRole = intent.getStringExtra(EXTRA_ROLE) ?: ROLE_DRIVER
        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        locationClient.removeLocationUpdates(locationCallback)
        scope.cancel()
        super.onDestroy()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.active_ride_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle(getString(R.string.active_ride_notification_title))
            .setContentText(getString(R.string.active_ride_notification_body))
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .build()
        locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    private suspend fun uploadBatch(rideSessionId: String, role: String, locations: List<Location>) {
        val updates = locations.map { location ->
            nativeLocationPayload(
                rideSessionId = rideSessionId,
                role = role,
                location = location,
            )
        }
        functions.getHttpsCallable("writeLocationBatch")
            .call(mapOf("updates" to updates))
            .await()
    }

    companion object {
        private const val EXTRA_RIDE_SESSION_ID = "rideSessionId"
        private const val EXTRA_ROLE = "role"
        private const val ROLE_DRIVER = "driver"
        private const val CHANNEL_ID = "active-ride-location"
        private const val NOTIFICATION_ID = 42
        private const val UPDATE_INTERVAL_MS = 15_000L
        private const val MIN_UPDATE_INTERVAL_MS = 10_000L

        fun intent(context: Context, rideSessionId: String, role: String): Intent =
            Intent(context, ActiveRideLocationService::class.java)
                .putExtra(EXTRA_RIDE_SESSION_ID, rideSessionId)
                .putExtra(EXTRA_ROLE, role)
    }
}
