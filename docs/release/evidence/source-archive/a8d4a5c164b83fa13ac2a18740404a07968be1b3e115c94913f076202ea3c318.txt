package be.sportgreenmoove.app.ui

import android.net.NetworkCapabilities
import org.json.JSONArray
import org.json.JSONObject

// Whitelist capabilities only: never serialize network identifiers, addresses or transportInfo.
internal fun localNetworkCapabilitySnapshot(
    active: NetworkCapabilities?,
    available: List<Pair<Boolean, NetworkCapabilities>>,
    elapsedRealtimeMs: Long,
): JSONObject {
    fun describe(capabilities: NetworkCapabilities) =
        localNetworkCapabilityDescription(capabilities::hasCapability, capabilities::hasTransport)
    return JSONObject().put("schemaVersion", 1)
        .put("scope", "read-only-network-capabilities-not-selection-reason-or-flow-proof")
        .put("sampledAtElapsedRealtimeMs", elapsedRealtimeMs)
        .put("atomicObservation", false)
        .put("active", active?.let(::describe) ?: JSONObject.NULL)
        .put("available", JSONArray(available.map { (isActive, capabilities) ->
            describe(capabilities).put("activeAtSnapshotStart", isActive)
        }))
}

internal fun localInternetTransports(capabilities: NetworkCapabilities?): List<String> =
    if (capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true)
        localNetworkTransports(capabilities::hasTransport) else emptyList()

internal fun localNetworkCapabilityDescription(hasCapability: (Int) -> Boolean, hasTransport: (Int) -> Boolean) = JSONObject()
    .put("transports", JSONArray(localNetworkTransports(hasTransport)))
    .put("internet", hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
    .put("validated", hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
    .put("captivePortal", hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL))
    .put("notSuspended", hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_SUSPENDED))
    .put("notMetered", hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED))
    .put("trusted", hasCapability(NetworkCapabilities.NET_CAPABILITY_TRUSTED))

private fun localNetworkTransports(hasTransport: (Int) -> Boolean) = listOf(
    NetworkCapabilities.TRANSPORT_WIFI to "wifi", NetworkCapabilities.TRANSPORT_CELLULAR to "cellular",
    NetworkCapabilities.TRANSPORT_ETHERNET to "ethernet", NetworkCapabilities.TRANSPORT_VPN to "vpn",
).filter { hasTransport(it.first) }.map { it.second }
