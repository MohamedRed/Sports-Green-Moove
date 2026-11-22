package be.sportgreenmoove.app.data

import org.junit.Assert.*
import org.junit.Test

class BookingIntentSnapshotTest {
    private val snapshot = BookingIntentSnapshot("2027-01-10T10:00:00.000Z", "2027-01-10T11:00:00.000Z",
        MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250, "driver", 4, "club", "team", "U8", 1500,
        "medium", false, true, true, "a".repeat(64))

    @Test fun callableAndDocumentMappersPreserveExactlyTheSameOperationalSnapshot() {
        val payload = snapshot.toCallablePayload()
        val document = (payload["terms"] as Map<*, *>) + (payload["context"] as Map<*, *>)
        assertEquals(snapshot, BookingIntentSnapshot.fromCallablePayload(payload))
        assertEquals(snapshot, BookingIntentSnapshot.fromTripData(document))
    }

    @Test fun nullableContextIsNotInventedAndMissingRequiredDetailsRemainUnbookable() {
        val minimal = snapshot.copy(clubId = null, teamId = null, category = null, pickupRadiusM = null,
            baggage = null, returnTrip = null, supportsVehicleTracking = null, supportsChildTracking = null,
            appliedChangeId = null, arrivalBy = null)
        assertEquals(minimal, BookingIntentSnapshot.fromCallablePayload(minimal.toCallablePayload()))
        assertNull(BookingIntentSnapshot.fromCallablePayload(emptyMap<String, Any>()))
        assertNull(BookingIntentSnapshot.fromTripData(mapOf("priceCents" to 250)))
    }

    @Test fun knownMalformedFieldsCannotBecomeDefaultedBookingTerms() {
        val terms = snapshot.toCallablePayload()["terms"] as Map<*, *>
        val context = snapshot.toCallablePayload()["context"] as Map<*, *>
        for ((key, value) in listOf("priceCents" to -1, "priceCents" to 2.5, "departureAt" to "yesterday",
            "arrivalBy" to "2027-01-10T09:00:00Z", "origin" to mapOf("lat" to 95, "lng" to 4)))
            assertNull(BookingIntentSnapshot.fromCallablePayload(mapOf("terms" to terms + (key to value), "context" to context)))
        for ((key, value) in listOf("seatsTotal" to 0, "driverUserId" to "../driver", "teamId" to "__reserved__",
            "baggage" to "invalid", "returnTrip" to "false", "pickupRadiusM" to 0, "appliedChangeId" to "old"))
            assertNull(BookingIntentSnapshot.fromCallablePayload(mapOf("terms" to terms, "context" to context + (key to value))))
    }

    @Test fun mappingCopiesMutableInputRatherThanKeepingAReferenceToItsLatestValues() {
        val terms = (snapshot.toCallablePayload()["terms"] as Map<*, *>).toMutableMap()
        val payload = mapOf("terms" to terms, "context" to snapshot.toCallablePayload()["context"])
        val displayed = BookingIntentSnapshot.fromCallablePayload(payload)
        terms["priceCents"] = 900
        assertEquals(250, displayed!!.priceCents)
        assertEquals(900, BookingIntentSnapshot.fromCallablePayload(payload)!!.priceCents)
    }
}
