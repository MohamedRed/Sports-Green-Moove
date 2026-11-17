package be.sportgreenmoove.app.ui

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LocalCellularObservationTest {
    @Test fun activeCellularDoesNotMeanTheOldWifiNetworkHasLeftTheObservation() {
        val sample = ready()
        sample.put("internetTransports", JSONArray(listOf("wifi", "cellular")))
        assertFalse(isExclusiveCellularObservation(sample))
        sample.put("internetTransports", JSONArray(listOf("cellular")))
        assertTrue(isExclusiveCellularObservation(sample))
    }
    @Test fun everyRequiredConditionMustHoldInTheSameRecordedObservation() {
        assertTrue(isExclusiveCellularObservation(ready()))
        for ((key, value) in listOf("phase" to "before", "wifiEnabled" to true, "mobileDataEnabled" to false,
            "activeNetwork" to false, "backendReachable" to false, "internetNetworkCount" to 0)) {
            assertFalse(key, isExclusiveCellularObservation(ready().put(key, value)))
        }
        for (key in listOf("activeInternetTransports", "internetTransports")) {
            for (routes in listOf(emptyList(), listOf("wifi"), listOf("cellular", "vpn"), listOf("cellular", "ethernet"))) {
                assertFalse(key, isExclusiveCellularObservation(ready().put(key, JSONArray(routes))))
            }
        }
    }
    private fun ready() = JSONObject().put("phase", "cellular-ready").put("wifiEnabled", false)
        .put("mobileDataEnabled", true).put("activeNetwork", true).put("backendReachable", true)
        .put("internetNetworkCount", 1).put("activeInternetTransports", JSONArray(listOf("cellular")))
        .put("internetTransports", JSONArray(listOf("cellular")))
}
