package be.sportgreenmoove.app.services

import org.junit.Assert.assertThrows
import org.junit.Test

class NativeLocationAcknowledgementTest {
    private val update = mapOf<String, Any>("rideSessionId" to "qa-ride", "role" to "driver", "capturedAt" to 1000L)
    private fun receipt(status: String = "retained") = mapOf<String, Any>("rideSessionId" to "qa-ride", "role" to "driver",
        "capturedAt" to 1000.0, "status" to status)
    private fun response(status: String = "retained") = mapOf("written" to if (status == "written") 1.0 else 0.0,
        "ignored" to if (status == "written") 0.0 else 1.0, "receipts" to listOf(receipt(status)))
    @Test fun anAuthenticatedRetainedPositionDoesNotNeedAnotherCommitToStartTracking() {
        requireNativeLocationAcknowledgement(response(), update)
        requireNativeLocationAcknowledgement(response("written"), update)
    }
    @Test fun ignoredInvalidCaptureCannotMasqueradeAsARetainedPoint() {
        assertThrows(ProviderConfigurationException::class.java) { requireNativeLocationAcknowledgement(response("invalid"), update) }
    }
    @Test fun anOldServerCountAloneIsNotAnAcknowledgement() {
        for (counts in listOf(mapOf("written" to 1), mapOf("written" to 0, "ignored" to 1)))
            assertThrows(ProviderConfigurationException::class.java) { requireNativeLocationAcknowledgement(counts, update) }
    }
    @Test fun mismatchedIdentityAndCaptureAreRejected() {
        for (patch in listOf(mapOf("rideSessionId" to "other"), mapOf("role" to "child"), mapOf("capturedAt" to 1001),
            mapOf("capturedAt" to 1000.5), mapOf("status" to "unknown"))) {
            assertThrows(ProviderConfigurationException::class.java) {
                requireNativeLocationAcknowledgement(response() + ("receipts" to listOf(receipt() + patch)), update)
            }
        }
    }
    @Test fun contradictoryFractionalOrUnboundedCountsAreRejected() {
        for (patch in listOf(mapOf("written" to 1), mapOf("ignored" to 0), mapOf("ignored" to 1.5),
            mapOf("ignored" to -1), mapOf("ignored" to Double.POSITIVE_INFINITY), mapOf("ignored" to 9_007_199_254_740_992.0)))
            assertThrows(ProviderConfigurationException::class.java) { requireNativeLocationAcknowledgement(response() + patch, update) }
    }
    @Test fun aSingleStartupPointCannotAcceptAnEmptyOrMultiPointResponse() {
        for (receipts in listOf(emptyList(), listOf(receipt(), receipt())))
            assertThrows(ProviderConfigurationException::class.java) {
                requireNativeLocationAcknowledgement(response() + ("receipts" to receipts), update)
            }
    }
}
