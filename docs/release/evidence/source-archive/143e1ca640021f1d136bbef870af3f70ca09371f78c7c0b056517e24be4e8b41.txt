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
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class ActiveRideLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val functions by lazy { FirebaseFunctions.getInstance() }
    private lateinit var locationClient: FusedLocationProviderClient
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val ownership = ActiveRideLocationLease({ auth.currentUser?.uid }, NativeTrackingAuthorization::currentRevision)
    private val authListener = FirebaseAuth.AuthStateListener {
        if (ownership.ownerChanged()) stopTracking()
    }

    private var locationCallback: LocationCallback? = null

    private fun callbackFor(lease: RideLocationLease) = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            if (!ownership.accepts(lease)) return
            val locations = result.locations
            if (locations.isEmpty()) return
            scope.launch {
                runCatching {
                    if (ownership.accepts(lease)) uploadBatch(lease, locations)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationClient = LocationServices.getFusedLocationProviderClient(this)
        ensureChannel()
        auth.addAuthStateListener(authListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val previous = ownership.snapshot()
        val lease = ownership.bind(intent?.getStringExtra(EXTRA_OWNER_UID),
            intent?.getStringExtra(EXTRA_RIDE_SESSION_ID), intent?.getStringExtra(EXTRA_ROLE),
            intent?.getLongExtra(EXTRA_AUTH_REVISION, -1) ?: -1)
        if (lease == null) {
            stopTracking()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())
        if (previous !== lease) {
            scope.coroutineContext.cancelChildren()
            stopLocationUpdates()
            startLocationUpdates(lease)
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        auth.removeAuthStateListener(authListener)
        ownership.clear()
        stopLocationUpdates()
        scope.cancel()
        super.onDestroy()
    }

    private fun stopTracking() {
        ownership.clear()
        stopLocationUpdates()
        scope.coroutineContext.cancelChildren()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
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
    private fun startLocationUpdates(lease: RideLocationLease) {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .build()
        val callback = callbackFor(lease)
        locationCallback = callback
        locationClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
    }

    private fun stopLocationUpdates() {
        locationCallback?.let { locationClient.removeLocationUpdates(it) }
        locationCallback = null
    }

    private suspend fun uploadBatch(lease: RideLocationLease, locations: List<Location>) {
        val updates = locations.map { location ->
            nativeLocationPayload(
                rideSessionId = lease.rideSessionId,
                role = lease.role,
                location = location,
            )
        }
        if (!ownership.accepts(lease)) return
        functions.getHttpsCallable("writeLocationBatch")
            .call(mapOf("updates" to updates))
            .await()
    }

    companion object {
        private const val EXTRA_RIDE_SESSION_ID = "rideSessionId"
        private const val EXTRA_ROLE = "role"
        private const val EXTRA_OWNER_UID = "ownerUid"
        private const val EXTRA_AUTH_REVISION = "authRevision"
        private const val CHANNEL_ID = "active-ride-location"
        private const val NOTIFICATION_ID = 42
        private const val UPDATE_INTERVAL_MS = 15_000L
        private const val MIN_UPDATE_INTERVAL_MS = 10_000L

        fun intent(context: Context, rideSessionId: String, role: String, ownerUid: String, authRevision: Long): Intent =
            Intent(context, ActiveRideLocationService::class.java)
                .putExtra(EXTRA_RIDE_SESSION_ID, rideSessionId)
                .putExtra(EXTRA_ROLE, role)
                .putExtra(EXTRA_OWNER_UID, ownerUid)
                .putExtra(EXTRA_AUTH_REVISION, authRevision)
    }
}
