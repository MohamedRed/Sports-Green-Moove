package be.sportgreenmoove.app.ui

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.UserManager
import android.provider.Settings
import android.telephony.SubscriptionManager
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
    recordStart: (JSONObject) -> Unit,
) : Closeable {
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
    private val telephony = context.getSystemService(TelephonyManager::class.java)
    private val resolver = context.contentResolver
    private val initialWifi: Boolean
    private val initialData: Boolean
    private var changed = false
    private val cellular = LocalRequestedTransport(connectivity, NetworkCapabilities.TRANSPORT_CELLULAR)
    private val wireless = LocalRequestedTransport(connectivity, NetworkCapabilities.TRANSPORT_WIFI)
    val cellularRequestRegistered get() = cellular.registered
    val wifiRequestRegistered get() = wireless.registered

    init {
        check(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR)
        check(context.packageName == "be.sportgreenmoove.app.local")
        check(BuildConfig.SGM_FIREBASE_EMULATOR_HOST in setOf("10.0.2.2", "127.0.0.1", "localhost"))
        check(FirebaseApp.getInstance().options.projectId == "demo-sgm-local-qa")
        check(session.getString("projectId") == "demo-sgm-local-qa" && session.getBoolean("disposableEmulator"))
        check(device.executeShellCommand("getprop ro.kernel.qemu").trim() == "1")
        initialWifi = wifi.isWifiEnabled
        initialData = telephony.isDataEnabled
        val initial = snapshot("initial").put("wifiEnabled", initialWifi).put("mobileDataEnabled", initialData)
            .put("userUnlocked", context.getSystemService(UserManager::class.java).isUserUnlocked)
            .put("deviceProvisionedSetting", Settings.Global.getString(resolver, Settings.Global.DEVICE_PROVISIONED) ?: JSONObject.NULL)
            .put("userSetupCompleteSetting", Settings.Secure.getString(resolver, "user_setup_complete") ?: JSONObject.NULL)
        requireLocalNetworkStart(initial, recordStart)
        try {
            wireless.start()
            cellular.start()
        } catch (failure: Throwable) {
            finishLocalNetworkCleanup(failure, cellular::close, wireless::close)
        }
    }

    fun preparedSnapshot() = snapshot("before").takeIf(::isInitialNetworkObservation)

    fun disconnect(awaitCellular: () -> Unit) {
        changed = true
        device.executeShellCommand("svc wifi disable")
        awaitCellular()
        device.executeShellCommand("svc data disable")
    }

    fun cellularReadySnapshot(): JSONObject? = snapshot("cellular-ready").takeIf(::isExclusiveCellularObservation)

    fun restore() {
        if (!changed) return
        try { device.executeShellCommand("svc wifi ${if (initialWifi) "enable" else "disable"}") }
        finally { device.executeShellCommand("svc data ${if (initialData) "enable" else "disable"}") }
        changed = false
    }

    fun connected() = connectivity.activeNetwork != null
    fun offline() = !connected() && internetNetworks() == 0 && !wifi.isWifiEnabled && !telephony.isDataEnabled
    fun restoredSnapshot() = snapshot("restored").takeIf(::isInitialNetworkObservation)

    fun backendReachable(): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(BuildConfig.SGM_FIREBASE_EMULATOR_HOST, 5001), 2_000) }
        true
    } catch (_: IOException) { false }

    fun snapshot(phase: String): JSONObject {
        val active = connectivity.activeNetwork
        val activeCapabilities = active?.let(connectivity::getNetworkCapabilities)
        val internetCapabilities = connectivity.allNetworks.mapNotNull(connectivity::getNetworkCapabilities)
            .filter { it.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) }
        return JSONObject().put("phase", phase).put("wifiEnabled", wifi.isWifiEnabled)
        .put("mobileDataEnabled", telephony.isDataEnabled).put("activeNetwork", active != null)
        .put("cellularRequestRegistered", cellularRequestRegistered)
        .put("cellularAvailableCallbacks", cellular.availableCount).put("cellularLostCallbacks", cellular.lostCount)
        .put("cellularUnavailableCallbacks", cellular.unavailableCount)
        .put("wifiRequestRegistered", wifiRequestRegistered)
        .put("wifiAvailableCallbacks", wireless.availableCount).put("wifiLostCallbacks", wireless.lostCount)
        .put("wifiUnavailableCallbacks", wireless.unavailableCount)
        .put("cellularDataState", telephony.dataState).put("simState", telephony.simState)
        .put("hasDefaultDataSubscription", SubscriptionManager.isValidSubscriptionId(SubscriptionManager.getDefaultDataSubscriptionId()))
        .put("airplaneModeSetting", Settings.Global.getString(resolver, Settings.Global.AIRPLANE_MODE_ON) ?: JSONObject.NULL)
        .put("mobileDataAlwaysOnSetting", Settings.Global.getString(resolver, "mobile_data_always_on") ?: JSONObject.NULL)
        .put("internetNetworkCount", internetCapabilities.size).put("backendReachable", backendReachable())
        .put("activeInternetTransports", org.json.JSONArray(transportNames(activeCapabilities)))
        .put("internetTransports", org.json.JSONArray(internetCapabilities.flatMap(::transportNames).distinct()))
    }

    private fun transportNames(capabilities: NetworkCapabilities?): List<String> {
        if (capabilities == null || !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return emptyList()
        return listOf(NetworkCapabilities.TRANSPORT_WIFI to "wifi", NetworkCapabilities.TRANSPORT_CELLULAR to "cellular",
            NetworkCapabilities.TRANSPORT_ETHERNET to "ethernet", NetworkCapabilities.TRANSPORT_VPN to "vpn")
            .filter { capabilities.hasTransport(it.first) }.map { it.second }
    }

    override fun close() {
        finishLocalNetworkCleanup(null, ::restore, cellular::close, wireless::close)
    }

    private fun internetNetworks() = connectivity.allNetworks.count { network ->
        connectivity.getNetworkCapabilities(network)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

}
