package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class TripCancellationMappingTest {
    private val request = TripCancellationRequest("trip", "a".repeat(64), "Match reporté")
    private val ready = mapOf<String, Any>("tripId" to "trip", "status" to "ready", "revision" to request.expectedRevision,
        "bookingCount" to 2, "refundPendingCount" to 1)
    private val receipt = request.callablePayload() + mapOf("status" to "cancelled", "bookingCount" to 2,
        "bookingIds" to listOf("booking-1", "booking-2"), "refundPendingCount" to 1, "seatsAvailable" to 3,
        "actorUserId" to "driver", "cancelledAt" to "2026-10-16T12:00:00.000Z")

    private fun rejects(block: () -> Unit) { try { block() } catch (expected: Exception) { return }; fail("Malformed response accepted") }

    @Test fun mapsReadyAndExactConfirmedReceipt() {
        assertEquals(TripCancellationReady("trip", request.expectedRevision, 2, 1), tripCancellationPreview(ready, "trip"))
        val confirmed = tripCancellationReceipt(receipt, request, "driver")
        assertEquals(2, confirmed.bookingCount); assertEquals(3, confirmed.seatsAvailable)
        assertEquals(request.requestId, confirmed.requestId)
    }

    @Test fun rejectsTruncatedFractionalOrConflictingCounts() {
        for (bad in listOf(null, emptyMap<String, Any>(), ready - "revision", ready + ("tripId" to "other"),
            ready + ("status" to "unknown"), ready + ("bookingCount" to 2.5), ready + ("bookingCount" to -1),
            ready + ("bookingCount" to 101), ready + ("bookingCount" to Double.NaN), ready + ("refundPendingCount" to 3),
            ready + ("revision" to "bad"))) rejects { tripCancellationPreview(bad, "trip") }
    }

    @Test fun rejectsMalformedOrUnrelatedReceipts() {
        for ((key, value) in listOf("bookingIds" to listOf("same", "same"), "bookingIds" to listOf("one"),
            "bookingIds" to listOf("one", 2), "bookingIds" to listOf("one", "__reserved__"),
            "bookingIds" to listOf("one", "x".repeat(257)), "seatsAvailable" to 9, "seatsAvailable" to 0.5,
            "actorUserId" to "other", "requestId" to java.util.UUID.randomUUID().toString(),
            "expectedRevision" to "b".repeat(64), "reason" to "Other reason", "cancelledAt" to "not-a-date")) {
            rejects { tripCancellationReceipt(receipt + (key to value), request, "driver") }
        }
        rejects { tripCancellationReceipt(ready, request, "driver") }
    }

    @Test fun payloadContainsOnlyValidatedIntent() {
        assertEquals(setOf("tripId", "requestId", "reason", "expectedRevision"), request.callablePayload().keys)
        for (bad in listOf(request.copy(tripId = "a/b"), request.copy(reason = "  Match reporté  "),
            request.copy(reason = "abcd"), request.copy(requestId = "bad"))) rejects { bad.callablePayload() }
    }

    @Test fun cancelledTripRemainsPastEvenBeforeDepartureAndRetainsOwnership() {
        val trip = mapTrip("trip", mapOf("status" to "cancelled", "driverUserId" to "driver", "departureAt" to "2099-10-16T12:00:00Z"))
        assertTrue(trip.cancelled); assertEquals("driver", trip.driverUserId); assertEquals(TripStatus.Past, trip.status)
    }
}
