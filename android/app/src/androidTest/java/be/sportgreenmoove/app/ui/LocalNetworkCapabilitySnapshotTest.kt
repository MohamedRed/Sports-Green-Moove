package be.sportgreenmoove.app.ui

import android.net.NetworkCapabilities
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LocalNetworkCapabilitySnapshotTest {
    @Test fun configuredInternetDoesNotInventValidationOrASelectionReason() {
        val active = describe(setOf(NetworkCapabilities.NET_CAPABILITY_INTERNET), setOf(NetworkCapabilities.TRANSPORT_WIFI))
        assertTrue(active.getBoolean("internet")); assertFalse(active.getBoolean("validated"))
        assertFalse(active.getBoolean("captivePortal"))
        assertEquals("wifi", active.getJSONArray("transports").getString(0))
        val item = localNetworkCapabilitySnapshot(null, emptyList(), 42)
        assertEquals(42L, item.getLong("sampledAtElapsedRealtimeMs")); assertFalse(item.getBoolean("atomicObservation"))
        assertEquals("read-only-network-capabilities-not-selection-reason-or-flow-proof", item.getString("scope"))
    }

    @Test fun availableAndActiveObservationsDoNotAliasEachOtherOrInventValidation() {
        val capabilities = NetworkCapabilities()
        val item = localNetworkCapabilitySnapshot(capabilities, listOf(false to capabilities, true to capabilities), 43)
        val rows = item.getJSONArray("available")
        assertFalse(rows.getJSONObject(0).getBoolean("activeAtSnapshotStart"))
        assertFalse(rows.getJSONObject(0).getBoolean("validated"))
        assertTrue(rows.getJSONObject(1).getBoolean("activeAtSnapshotStart"))
        assertFalse(item.getJSONObject("active").has("activeAtSnapshotStart"))
        val cellular = describe(setOf(NetworkCapabilities.NET_CAPABILITY_INTERNET,
            NetworkCapabilities.NET_CAPABILITY_VALIDATED), setOf(NetworkCapabilities.TRANSPORT_CELLULAR))
        assertTrue(cellular.getBoolean("validated"))
        assertEquals("cellular", cellular.getJSONArray("transports").getString(0))
    }

    @Test fun unknownActiveNetworkAndNonInternetNetworksAreNotReportedAsConnected() {
        val localWifi = NetworkCapabilities()
        val item = localNetworkCapabilitySnapshot(null, listOf(false to localWifi), 44)
        assertSame(JSONObject.NULL, item.get("active"))
        assertFalse(item.getJSONArray("available").getJSONObject(0).getBoolean("internet"))
        assertEquals(emptyList<String>(), localInternetTransports(localWifi))
        assertEquals(emptyList<String>(), localInternetTransports(null))
        assertEquals(0, localNetworkCapabilitySnapshot(null, emptyList(), 45).getJSONArray("available").length())
    }

    @Test fun captivePortalAndVpnRemainMeasuredAndOnlyWhitelistedFieldsAreWritten() {
        val active = describe(setOf(NetworkCapabilities.NET_CAPABILITY_INTERNET, NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL),
            setOf(NetworkCapabilities.TRANSPORT_WIFI, NetworkCapabilities.TRANSPORT_VPN))
        assertTrue(active.getBoolean("captivePortal")); assertFalse(active.getBoolean("validated"))
        val transports = active.getJSONArray("transports")
        assertEquals(listOf("wifi", "vpn"), List(transports.length()) { transports.getString(it) })
        assertEquals(setOf("transports", "internet", "validated", "captivePortal",
            "notSuspended", "notMetered", "trusted"), active.keys().asSequence().toSet())
    }

    private fun describe(capabilities: Set<Int>, transports: Set<Int>) =
        localNetworkCapabilityDescription(capabilities::contains, transports::contains)
}
