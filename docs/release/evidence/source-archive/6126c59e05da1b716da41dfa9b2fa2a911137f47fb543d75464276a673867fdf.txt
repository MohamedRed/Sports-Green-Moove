package be.sportgreenmoove.app.ui

import android.content.Context
import android.location.Location
import android.os.SystemClock
import be.sportgreenmoove.app.BuildConfig
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit
import java.io.File
import org.json.JSONObject

internal class LocalMockLocation(context: Context) : AutoCloseable {
    private val client = LocationServices.getFusedLocationProviderClient(context)

    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        val session = JSONObject(File(context.filesDir, "local-qa-session.json").readText())
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        Tasks.await(client.setMockMode(true), 15, TimeUnit.SECONDS)
    }

    fun emit(capturedAt: Long = System.currentTimeMillis()): Location {
        val location = Location("fused").apply {
            latitude = 50.7167
            longitude = 4.6167
            accuracy = 5f
            time = capturedAt
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }
        Tasks.await(client.setMockLocation(location), 15, TimeUnit.SECONDS)
        return location
    }

    override fun close() {
        Tasks.await(client.setMockMode(false), 15, TimeUnit.SECONDS)
    }
}
