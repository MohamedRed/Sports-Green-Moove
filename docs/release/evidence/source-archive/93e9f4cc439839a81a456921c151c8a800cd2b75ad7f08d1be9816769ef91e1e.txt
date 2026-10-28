package be.sportgreenmoove.app.ui

import org.json.JSONObject

internal fun isExclusiveCellularObservation(sample: JSONObject): Boolean {
    fun transports(key: String) = sample.getJSONArray(key).let { values ->
        List(values.length()) { values.getString(it) }.toSet()
    }
    return sample.getString("phase") == "cellular-ready" && !sample.getBoolean("wifiEnabled") &&
        sample.getBoolean("mobileDataEnabled") && sample.getBoolean("activeNetwork") &&
        sample.getBoolean("backendReachable") && sample.getInt("internetNetworkCount") > 0 &&
        transports("activeInternetTransports") == setOf("cellular") && transports("internetTransports") == setOf("cellular")
}
