package be.sportgreenmoove.app.ui

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.telephony.TelephonyManager
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.BuildConfig
import com.google.firebase.FirebaseApp
import org.json.JSONObject
import java.io.Closeable
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

internal class LocalEmulatorNetwork(
    context: Context,
    private val device: UiDevice,
    session: JSONObject,
) : Closeable {
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
    private val telephony = context.getSystemService(TelephonyManager::class.java)
    private val initialWifi: Boolean
    private val initialData: Boolean
    private var changed = false

    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        initialWifi = wifi.isWifiEnabled
        initialData = telephony.isDataEnabled
        check(connected()) { "The disposable device must start connected" }
        check(backendReachable()) { "The isolated backend must start reachable" }
    }

    fun disconnect() {
        changed = true
        device.executeShellCommand("svc wifi disable")
        device.executeShellCommand("svc data disable")
    }

    fun restore() {
        if (!changed) return
        try { device.executeShellCommand("svc wifi ${if (initialWifi) "enable" else "disable"}") }
        finally { device.executeShellCommand("svc data ${if (initialData) "enable" else "disable"}") }
        changed = false
    }

    fun connected() = connectivity.activeNetwork != null
    fun offline() = !connected() && internetNetworks() == 0 && !wifi.isWifiEnabled && !telephony.isDataEnabled
    fun restored() = connected() && wifi.isWifiEnabled == initialWifi && telephony.isDataEnabled == initialData

    fun backendReachable(): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001), 2_000) }
        true
    } catch (_: IOException) { false }

    fun snapshot(phase: String) = JSONObject().put("phase", phase).put("wifiEnabled", wifi.isWifiEnabled)
        .put("mobileDataEnabled", telephony.isDataEnabled).put("activeNetwork", connected())
        .put("internetNetworkCount", internetNetworks()).put("backendReachable", backendReachable())
        .put("internetTransports", org.json.JSONArray(connectivity.allNetworks.mapNotNull { network ->
            connectivity.getNetworkCapabilities(network)?.takeIf { it.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) }
                ?.let { capabilities -> listOf(NetworkCapabilities.TRANSPORT_WIFI to "wifi",
                    NetworkCapabilities.TRANSPORT_CELLULAR to "cellular", NetworkCapabilities.TRANSPORT_ETHERNET to "ethernet",
                    NetworkCapabilities.TRANSPORT_VPN to "vpn").filter { capabilities.hasTransport(it.first) }.map { it.second } }
        }.flatten().distinct()))

    override fun close() { restore() }

    private fun internetNetworks() = connectivity.allNetworks.count { network ->
        connectivity.getNetworkCapabilities(network)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

}
