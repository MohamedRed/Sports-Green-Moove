package be.sportgreenmoove.app.ui

import org.json.JSONObject

internal fun isInitialNetworkObservation(sample: JSONObject): Boolean {
    fun transports(key: String) = sample.getJSONArray(key).let { values ->
        List(values.length()) { values.getString(it) }.toSet()
    }
    return sample.getString("phase") in setOf("before", "restored") &&
        sample.getBoolean("wifiEnabled") && sample.getBoolean("mobileDataEnabled") &&
        sample.getBoolean("wifiRequestRegistered") && sample.getBoolean("cellularRequestRegistered") &&
        sample.getBoolean("activeNetwork") && sample.getBoolean("backendReachable") &&
        sample.getInt("internetNetworkCount") >= 2 &&
        transports("activeInternetTransports") == setOf("wifi") &&
        transports("internetTransports") == setOf("wifi", "cellular")
}
