package be.sportgreenmoove.app.ui

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LocalInitialNetworkObservationTest {
    @Test fun enabledWifiWithOnlyCellularInternetIsNotPreparedOrRestored() {
        val sample = ready().put("internetNetworkCount", 1)
            .put("activeInternetTransports", JSONArray(listOf("cellular")))
            .put("internetTransports", JSONArray(listOf("cellular")))
        assertFalse(isInitialNetworkObservation(sample))
        assertFalse(isInitialNetworkObservation(sample.put("phase", "restored")))
    }
    @Test fun bothActualNetworksAndWifiDefaultAreRequiredInTheRecordedObservation() {
        assertTrue(isInitialNetworkObservation(ready()))
        assertTrue(isInitialNetworkObservation(ready().put("phase", "restored")))
        for ((key, value) in listOf("phase" to "preparing", "wifiEnabled" to false, "mobileDataEnabled" to false,
            "wifiRequestRegistered" to false, "cellularRequestRegistered" to false, "activeNetwork" to false,
            "backendReachable" to false, "internetNetworkCount" to 1)) {
            assertFalse(key, isInitialNetworkObservation(ready().put(key, value)))
        }
        for (routes in listOf(emptyList(), listOf("wifi"), listOf("cellular"), listOf("wifi", "cellular", "vpn"))) {
            assertFalse(isInitialNetworkObservation(ready().put("internetTransports", JSONArray(routes))))
        }
        assertFalse(isInitialNetworkObservation(ready().put("activeInternetTransports", JSONArray(listOf("cellular")))))
    }
    private fun ready() = JSONObject().put("phase", "before").put("wifiEnabled", true).put("mobileDataEnabled", true)
        .put("wifiRequestRegistered", true).put("cellularRequestRegistered", true)
        .put("activeNetwork", true).put("backendReachable", true).put("internetNetworkCount", 2)
        .put("activeInternetTransports", JSONArray(listOf("wifi")))
        .put("internetTransports", JSONArray(listOf("wifi", "cellular")))
}
