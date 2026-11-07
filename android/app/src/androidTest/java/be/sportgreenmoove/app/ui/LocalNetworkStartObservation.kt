package be.sportgreenmoove.app.ui

import org.json.JSONObject

internal fun requireLocalNetworkStart(sample: JSONObject, record: (JSONObject) -> Unit) {
    val wifi = sample.getBoolean("wifiEnabled")
    val data = sample.getBoolean("mobileDataEnabled")
    val connected = sample.getBoolean("activeNetwork")
    val reachable = sample.getBoolean("backendReachable")
    record(JSONObject(sample.toString()))
    check(wifi && data) { "The handover scenario requires both test radios enabled" }
    check(connected) { "The disposable device must start connected" }
    check(reachable) { "The isolated backend must start reachable" }
}
