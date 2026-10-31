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
import android.os.SystemClock
import be.sportgreenmoove.app.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
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
    private var lifecycleWatch: ListenerRegistration? = null
    @Volatile private var captureClock: NativeCaptureClock? = null

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
        activeService = this
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
            val clock = try {
                clockFromIntent(intent)
            } catch (_: IllegalArgumentException) {
                stopTracking()
                return START_NOT_STICKY
            }
            if (clock.snapshot().receivedElapsedNanos > SystemClock.elapsedRealtimeNanos() ||
                clock.state().maximumAssignedElapsedNanos > SystemClock.elapsedRealtimeNanos()) {
                stopTracking()
                return START_NOT_STICKY
            }
            scope.coroutineContext.cancelChildren()
            stopLifecycleWatch()
            stopLocationUpdates()
            captureClock = clock
            startLocationUpdates(lease)
            lifecycleWatch = watchRideLifecycle(FirebaseFirestore.getInstance(), lease) { decision ->
                if (ownership.accepts(lease) && decision == RideLifecycleDecision.STOP) stopTracking()
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (activeService === this) activeService = null
        auth.removeAuthStateListener(authListener)
        ownership.clear()
        captureClock = null
        stopLifecycleWatch()
        stopLocationUpdates()
        scope.cancel()
        super.onDestroy()
    }

    private fun stopTracking() {
        ownership.clear()
        captureClock = null
        stopLifecycleWatch()
        stopLocationUpdates()
        scope.coroutineContext.cancelChildren()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopLifecycleWatch() {
        lifecycleWatch?.remove()
        lifecycleWatch = null
    }

    private fun clockFromIntent(intent: Intent?): NativeCaptureClock {
        val payload = requireNotNull(intent)
        val times = requireNotNull(payload.getLongArrayExtra(EXTRA_SERVER_TIME))
        val received = requireNotNull(payload.getLongArrayExtra(EXTRA_CLOCK_RECEIVED))
        val started = requireNotNull(payload.getLongArrayExtra(EXTRA_CLOCK_STARTED))
        val effective = requireNotNull(payload.getLongArrayExtra(EXTRA_CLOCK_EFFECTIVE))
        require(times.size == received.size && times.size == started.size && times.size == effective.size)
        return NativeCaptureClock(NativeCaptureClockState(times.indices.map { NativeServerTimeAnchor(times[it], received[it], started[it]) },
            payload.getLongExtra(EXTRA_CLOCK_FLOOR, -1), effective.toList(), payload.getLongExtra(EXTRA_CLOCK_ASSIGNED, -1)))
    }

    private fun ownedClock(ownerUid: String, rideSessionId: String, role: String, revision: Long): NativeCaptureClock? {
        val lease = ownership.snapshot() ?: return null
        return captureClock.takeIf { lease.ownerUid == ownerUid && lease.rideSessionId == rideSessionId &&
            lease.role == role && lease.authRevision == revision }
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
        val clock = captureClock ?: return
        val updates = locations.map { location ->
            nativeLocationPayload(
                rideSessionId = lease.rideSessionId,
                role = lease.role,
                location = location,
                clock = clock,
            )
        }
        if (!ownership.accepts(lease)) return
        val started = SystemClock.elapsedRealtimeNanos()
        val result = functions.getHttpsCallable("writeLocationBatch")
            .call(mapOf("updates" to updates))
            .await()
        if (ownership.accepts(lease) && captureClock === clock)
            clock.observe(result.data, started, SystemClock.elapsedRealtimeNanos())
    }

    companion object {
        private const val EXTRA_RIDE_SESSION_ID = "rideSessionId"
        private const val EXTRA_ROLE = "role"
        private const val EXTRA_OWNER_UID = "ownerUid"
        private const val EXTRA_AUTH_REVISION = "authRevision"
        private const val EXTRA_SERVER_TIME = "serverTimeMs"
        private const val EXTRA_CLOCK_RECEIVED = "clockReceivedElapsedNanos"
        private const val EXTRA_CLOCK_STARTED = "clockRequestStartedElapsedNanos"
        private const val EXTRA_CLOCK_FLOOR = "clockMinimumElapsedNanos"
        private const val EXTRA_CLOCK_EFFECTIVE = "clockEffectiveFromElapsedNanos"
        private const val EXTRA_CLOCK_ASSIGNED = "clockMaximumAssignedElapsedNanos"
        @Volatile private var activeService: ActiveRideLocationService? = null
        private const val CHANNEL_ID = "active-ride-location"
        private const val NOTIFICATION_ID = 42
        private const val UPDATE_INTERVAL_MS = 15_000L
        private const val MIN_UPDATE_INTERVAL_MS = 10_000L

        internal fun clockFor(ownerUid: String, rideSessionId: String, role: String, revision: Long): NativeCaptureClock? =
            activeService?.ownedClock(ownerUid, rideSessionId, role, revision)

        internal fun intent(context: Context, rideSessionId: String, role: String, ownerUid: String, authRevision: Long, clock: NativeCaptureClockState): Intent =
            Intent(context, ActiveRideLocationService::class.java)
                .putExtra(EXTRA_RIDE_SESSION_ID, rideSessionId)
                .putExtra(EXTRA_ROLE, role)
                .putExtra(EXTRA_OWNER_UID, ownerUid)
                .putExtra(EXTRA_AUTH_REVISION, authRevision)
                .putExtra(EXTRA_SERVER_TIME, clock.anchors.map { it.serverTimeMs }.toLongArray())
                .putExtra(EXTRA_CLOCK_RECEIVED, clock.anchors.map { it.receivedElapsedNanos }.toLongArray())
                .putExtra(EXTRA_CLOCK_STARTED, clock.anchors.map { it.requestStartedElapsedNanos }.toLongArray())
                .putExtra(EXTRA_CLOCK_FLOOR, clock.minimumElapsedNanos)
                .putExtra(EXTRA_CLOCK_EFFECTIVE, clock.effectiveFromElapsedNanos.toLongArray())
                .putExtra(EXTRA_CLOCK_ASSIGNED, clock.maximumAssignedElapsedNanos)
    }
}
