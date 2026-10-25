package be.sportgreenmoove.app.services

import java.util.Random
import org.junit.Assert.*
import org.junit.Test

class NativeCaptureClockTest {
    private val epoch = 1_792_930_000_000L
    private fun ns(ms: Long) = ms * 1_000_000
    private fun anchor(server: Long = epoch, received: Long = ns(2_000), started: Long = ns(1_900)) =
        NativeServerTimeAnchor(server, received, started)
    private fun response(server: Any?) = mapOf("serverTimeMs" to server)

    @Test fun aFixBeforeTheResponseKeepsItsRealElapsedAge() {
        val clock = NativeCaptureClock(anchor())
        assertEquals(epoch - 1_000, clock.capturedAt(ns(1_000), ns(2_000)))
        assertEquals(epoch - 1_000, clock.capturedAt(ns(1_000), ns(300_000)))
    }
    @Test fun aFixAfterTheReferenceAdvancesWithoutReadingAWallClock() {
        val clock = NativeCaptureClock(anchor())
        assertEquals(epoch + 15_000, clock.capturedAt(ns(17_000), ns(17_500)))
        assertEquals(epoch + 2_999, clock.capturedAt(ns(5_000) - 1, ns(5_000)))
    }
    @Test fun subMillisecondAgesRoundDownRatherThanInventingAFutureCapture() {
        val clock = NativeCaptureClock(anchor(received = ns(2_000) + 1))
        assertEquals(epoch - 1, clock.capturedAt(ns(2_000), ns(2_001)))
    }
    @Test fun networkDelayRemainsConservativeInsteadOfBeingAddedToTheFix() {
        val clock = NativeCaptureClock(anchor(received = ns(62_000)))
        assertEquals(epoch - 61_000, clock.capturedAt(ns(1_000), ns(62_000)))
    }
    @Test fun aLaterFasterResponseCannotMakeAnOldFixLookNewer() {
        val clock = NativeCaptureClock(anchor())
        val before = clock.capturedAt(ns(1_000), ns(2_000))
        clock.observe(response(epoch + 2_000), ns(2_900), ns(3_000))
        assertEquals(before, clock.capturedAt(ns(1_000), ns(3_000)))
    }
    @Test fun aLowerReferenceCorrectsTheMappingWithoutRejuvenatingDelayedFixes() {
        val clock = NativeCaptureClock(anchor())
        clock.observe(response(epoch + 500), ns(2_900), ns(3_000))
        assertEquals(epoch - 1_000, clock.capturedAt(ns(1_000), ns(3_000)))
        assertEquals(epoch + 500, clock.capturedAt(ns(3_000), ns(3_000)))
    }
    @Test fun fractionalOffsetChangesCannotRejuvenateAFixByOneMillisecond() {
        val clock = NativeCaptureClock(anchor(server = 100_000, received = 1_000_100, started = 1))
        assertEquals(99_999, clock.capturedAt(1_000_000, 1_000_100))
        clock.observe(response(100_002), 2_000_000, 3_000_000)
        assertEquals(99_999, clock.capturedAt(1_000_000, 3_000_000))
    }
    @Test fun oldAndDuplicateRepliesCannotReplaceTheNewestRequestReference() {
        val clock = NativeCaptureClock(anchor())
        clock.observe(response(epoch + 500), ns(2_900), ns(3_000))
        val accepted = clock.snapshot()
        clock.observe(response(epoch - 50_000), ns(2_800), ns(4_000))
        clock.observe(response(epoch - 50_000), ns(2_900), ns(5_000))
        assertEquals(accepted, clock.snapshot())
    }
    @Test fun aReplyFromBeforeTheCurrentAnchorCannotMoveIt() {
        val clock = NativeCaptureClock(anchor())
        clock.observe(response(epoch - 50_000), ns(1_950), ns(1_999))
        assertEquals(anchor(), clock.snapshot())
    }
    @Test fun malformedOrMissingServerTimeIsNotADeviceClockFallback() {
        for (value in listOf(null, "1792930000000", 0, -1, 0.5, Double.NaN, Double.POSITIVE_INFINITY, 9_007_199_254_740_992.0)) {
            assertThrows(IllegalArgumentException::class.java) { NativeServerTimeAnchor.fromResponse(response(value), ns(1), ns(2)) }
        }
        assertThrows(IllegalArgumentException::class.java) { NativeServerTimeAnchor.fromResponse(emptyMap<String, Any>(), ns(1), ns(2)) }
    }
    @Test fun integerCallableNumbersAreAcceptedWithoutChangingTheirTime() {
        assertEquals(anchor(), NativeServerTimeAnchor.fromResponse(response(epoch.toDouble()), ns(1_900), ns(2_000)))
    }
    @Test fun invalidCalibrationDoesNotMutateTheLastTrustedMapping() {
        val clock = NativeCaptureClock(anchor())
        assertThrows(IllegalArgumentException::class.java) { clock.observe(response(Double.NaN), ns(2_900), ns(3_000)) }
        assertEquals(anchor(), clock.snapshot())
    }
    @Test fun zeroNegativeOrFutureSensorTimesAreRejected() {
        val clock = NativeCaptureClock(anchor())
        for (capture in listOf(0L, -1L, ns(3_000) + 1))
            assertThrows(IllegalArgumentException::class.java) { clock.capturedAt(capture, ns(3_000)) }
    }
    @Test fun aResetMonotonicCounterCannotReuseTheOldProcessReference() {
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClock(anchor()).capturedAt(ns(100), ns(200)) }
    }
    @Test fun invalidReferenceIntervalsAndOutOfRangeCaptureResultsFailClosed() {
        for (value in listOf(0L, -1L, NativeServerTimeAnchor.MAX_SAFE_TIME + 1))
            assertThrows(IllegalArgumentException::class.java) { anchor(server = value) }
        assertThrows(IllegalArgumentException::class.java) { anchor(started = 0) }
        assertThrows(IllegalArgumentException::class.java) { anchor(started = ns(2_001)) }
        val maximum = NativeCaptureClock(anchor(server = NativeServerTimeAnchor.MAX_SAFE_TIME))
        assertThrows(IllegalArgumentException::class.java) { maximum.capturedAt(ns(2_001), ns(2_001)) }
        val minimum = NativeCaptureClock(anchor(server = 1))
        assertThrows(IllegalArgumentException::class.java) { minimum.capturedAt(ns(1_000), ns(2_000)) }
    }
    @Test fun manyCalibrationsNeverMakeTheSameDelayedCaptureYounger() {
        val random = Random(25)
        val clock = NativeCaptureClock(anchor())
        var previous = clock.capturedAt(ns(1_000), ns(2_000))
        for (index in 1..200) {
            val elapsed = ns(2_000L + index * 15_000L) + random.nextInt(1_000_000)
            val server = epoch + index * 15_000L + random.nextInt(1_000) - 500
            clock.observe(response(server), elapsed - ns(10), elapsed)
            val current = clock.capturedAt(ns(1_000), elapsed)
            assertEquals(previous, current)
            previous = current
        }
    }
    @Test fun aSlowResponseDoesNotPermanentlyPoisonTrackingAfterNetworkRecovery() {
        val clock = NativeCaptureClock(anchor())
        clock.observe(response(epoch + 1_000), ns(2_900), ns(62_000))
        val delayed = clock.capturedAt(ns(63_000), ns(63_000))
        assertEquals(epoch + 2_000, delayed)
        clock.observe(response(epoch + 62_000), ns(63_900), ns(64_000))
        assertEquals(epoch + 63_000, clock.capturedAt(ns(65_000), ns(65_000)))
        assertEquals(delayed, clock.capturedAt(ns(63_000), ns(65_000)))
    }
    @Test fun startupHandoffPreservesEveryCaptureEpochInsteadOfReanchoringCachedFixes() {
        val clock = NativeCaptureClock(anchor())
        clock.observe(response(epoch + 2_000), ns(2_900), ns(3_000))
        val handedOff = NativeCaptureClock(clock.state())
        for (capture in listOf(ns(1_000), ns(2_500), ns(3_000), ns(4_000)))
            assertEquals(clock.capturedAt(capture, ns(5_000)), handedOff.capturedAt(capture, ns(5_000)))
    }
    @Test fun boundedHistoryRejectsEvictedFixesRatherThanGivingThemANewCaptureTime() {
        val clock = NativeCaptureClock(anchor())
        for (index in 1..300) clock.observe(response(epoch + index * 1_000L), ns(2_000L + index * 1_000L - 10), ns(2_000L + index * 1_000L))
        assertEquals(256, clock.state().anchors.size)
        assertThrows(IllegalArgumentException::class.java) { clock.capturedAt(ns(1_000), ns(303_000)) }
        assertEquals(epoch + 301_000, clock.capturedAt(ns(303_000), ns(303_000)))
    }
    @Test fun malformedClockHistoryCannotCrossTheServiceBoundary() {
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(emptyList()) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor()), 0) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor()), ns(2_001)) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor(), anchor())) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor()), effectiveFromElapsedNanos = emptyList()) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor()), effectiveFromElapsedNanos = listOf(ns(1_000))) }
        assertThrows(IllegalArgumentException::class.java) { NativeCaptureClockState(listOf(anchor()), maximumAssignedElapsedNanos = -1) }
        val original = mutableListOf(anchor())
        val clock = NativeCaptureClock(NativeCaptureClockState(original))
        original.clear()
        assertEquals(anchor(), clock.snapshot())
    }
    @Test fun aDelayedCalibrationCannotRetroactivelyChangeAFixAssignedByAnotherCallback() {
        val clock = NativeCaptureClock(anchor())
        val fixed = clock.capturedAt(ns(4_000), ns(4_000))
        clock.observe(response(epoch + 10_000), ns(2_900), ns(3_000))
        assertEquals(fixed, clock.capturedAt(ns(4_000), ns(5_000)))
        assertEquals(epoch + 12_000, clock.capturedAt(ns(5_000), ns(5_000)))
        val handedOff = NativeCaptureClock(clock.state())
        assertEquals(fixed, handedOff.capturedAt(ns(4_000), ns(5_000)))
        assertEquals(epoch + 12_000, handedOff.capturedAt(ns(5_000), ns(5_000)))
    }
}
