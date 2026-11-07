package be.sportgreenmoove.app.ui

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

internal class LocalSessionTransportDiagnostics(
    private val context: Context,
    device: UiDevice,
    private val session: JSONObject,
    private val proxyPort: Int,
) {
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val observations = JSONArray()
    private val file = File(context.getExternalFilesDir(null), "local-ui-evidence/session-transport-observations.json")

    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(session.getString("runId").matches(Regex("[a-f0-9]{32}")))
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        check(proxyPort in 1024..65535 && proxyPort !in setOf(9099, 5001))
        check(!file.exists())
    }

    fun checkpoint(phase: String) {
        check(phase in setOf("before-sign-in", "signed-in", "launching-app", "initial-error", "rotated-error",
            "recovered", "restored", "identity-verified", "failure"))
        check(observations.length() < 9)
        val active = connectivity.activeNetwork
        val capabilities = active?.let(connectivity::getNetworkCapabilities)
        val item = JSONObject().put("phase", phase).put("elapsedRealtimeMs", SystemClock.elapsedRealtime())
            .put("activeNetwork", active != null)
            .put("internetCapability", capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true)
            .put("validatedCapability", capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true)
            .put("transports", JSONArray(listOf(NetworkCapabilities.TRANSPORT_WIFI to "wifi",
                NetworkCapabilities.TRANSPORT_CELLULAR to "cellular", NetworkCapabilities.TRANSPORT_ETHERNET to "ethernet",
                NetworkCapabilities.TRANSPORT_VPN to "vpn").filter { capabilities?.hasTransport(it.first) == true }.map { it.second }))
        if (phase == "before-sign-in" || phase == "failure") item.put("tcp", JSONArray(
            listOf("auth" to 9099, "functions" to 5001, "controlled-proxy" to proxyPort).map { (service, port) ->
                val probe = JSONObject().put("service", service).put("port", port)
                try {
                    Socket().use { it.connect(InetSocketAddress(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, port), 2_000) }
                    probe.put("connected", true).put("failureKind", JSONObject.NULL)
                } catch (error: IOException) {
                    probe.put("connected", false).put("failureKind", error.javaClass.simpleName)
                }
            }))
        observations.put(item)
        file.writeText(JSONObject().put("scope", "read-only-local-session-transport-not-flow-verification")
            .put("projectId", "demo-sgm-local-qa").put("runId", session.getString("runId"))
            .put("networkSettingsChanged", false).put("authenticationRetried", false)
            .put("observations", observations).toString(2))
    }
}
