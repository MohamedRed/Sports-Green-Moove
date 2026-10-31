package be.sportgreenmoove.app.ui

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class LocalNetworkStartObservationTest {
    @Test fun readyStateIsRecordedOnceWithoutChangingTheSample() {
        val sample = ready(); val before = sample.toString(); var records = 0
        requireLocalNetworkStart(sample) { records++; assertEquals(before, it.toString()) }
        assertEquals(1, records); assertEquals(before, sample.toString())
    }
    @Test fun eachDisabledRadioIsRecordedBeforeTheSameStrictFailure() {
        for (key in listOf("wifiEnabled", "mobileDataEnabled")) {
            var recorded: JSONObject? = null
            val failure = assertThrows(IllegalStateException::class.java) {
                requireLocalNetworkStart(ready().put(key, false)) { recorded = it }
            }
            assertEquals("The handover scenario requires both test radios enabled", failure.message)
            assertFalse(checkNotNull(recorded).getBoolean(key))
        }
    }
    @Test fun disconnectedStateIsRecordedBeforeRefusal() {
        var records = 0
        val failure = assertThrows(IllegalStateException::class.java) {
            requireLocalNetworkStart(ready().put("activeNetwork", false)) {
                records++; assertFalse(it.getBoolean("activeNetwork"))
            }
        }
        assertEquals("The disposable device must start connected", failure.message); assertEquals(1, records)
    }
    @Test fun unreachableBackendIsRecordedBeforeRefusal() {
        var records = 0
        val failure = assertThrows(IllegalStateException::class.java) {
            requireLocalNetworkStart(ready().put("backendReachable", false)) {
                records++; assertFalse(it.getBoolean("backendReachable"))
            }
        }
        assertEquals("The isolated backend must start reachable", failure.message); assertEquals(1, records)
    }
    @Test fun recordingFailurePropagatesWithoutRetryOrPassingTheGuard() {
        val expected = IllegalStateException("Cannot save the observation"); var records = 0
        val failure = assertThrows(IllegalStateException::class.java) {
            requireLocalNetworkStart(ready()) { records++; throw expected }
        }
        assertSame(expected, failure); assertEquals(1, records)
    }
    @Test fun aRecorderCannotMutateTheMeasuredStateToBypassTheGuard() {
        val sample = ready().put("mobileDataEnabled", false)
        assertThrows(IllegalStateException::class.java) {
            requireLocalNetworkStart(sample) { it.put("mobileDataEnabled", true) }
        }
        assertFalse(sample.getBoolean("mobileDataEnabled"))
    }
    private fun ready() = JSONObject().put("phase", "initial").put("wifiEnabled", true)
        .put("mobileDataEnabled", true).put("activeNetwork", true).put("backendReachable", true)
}
