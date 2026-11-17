package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.BookingIntentSnapshot
import com.google.firebase.Timestamp
import org.junit.Assert.*
import org.junit.Test
import java.util.Date

class BookingIntentMappingTest {
    private val document: Map<String, Any> = mapOf("departureAt" to "2027-01-10T10:00:00.000Z",
        "origin" to mapOf("lat" to 50.7, "lng" to 4.6), "destination" to mapOf("lat" to 50.8, "lng" to 4.3),
        "priceCents" to 250, "driverUserId" to "driver", "seatsTotal" to 4, "seatsAvailable" to 4)

    @Test fun publishedAndSearchResultsCarryTheirDisplayedTermsIntoTheRequest() {
        val trip = mapTrip("trip", document)
        val result = mapTripMatch(mapOf("tripId" to "trip", "summary" to mapOf("id" to "trip",
            "bookingIntent" to trip.bookingIntent!!.toCallablePayload())))!!
        assertEquals(trip.bookingIntent, result.summary.bookingIntent)
        assertEquals(trip.bookingIntent!!.toCallablePayload(), bookingRequestPayload(result.summary, null, 2)["expectedBookingIntent"])
    }
    @Test fun existingTimestampAndDateDocumentsRemainBookable() {
        val date = Date.from(java.time.Instant.parse("2027-01-10T10:00:00Z"))
        for (value in listOf(date, Timestamp(date))) {
            val trip = mapTrip("trip", document + ("departureAt" to value))
            assertEquals(java.time.Instant.parse("2027-01-10T10:00:00Z"), java.time.Instant.parse(trip.bookingIntent!!.departureAt))
            assertTrue(bookingRequestPayload(trip, null, 1).containsKey("expectedBookingIntent"))
        }
    }
    @Test fun inconsistentResultIdentityFailsRatherThanBookingAnotherTrip() {
        assertTrue(runCatching { mapTripMatch(mapOf("tripId" to "other", "summary" to mapOf("id" to "trip"))) }.isFailure)
    }
    @Test fun aPreviewWithoutValidTermsCannotBeSilentlyRequotedAtDispatch() {
        val result = mapTripMatch(mapOf("tripId" to "trip", "summary" to mapOf("id" to "trip")))!!
        assertNull(result.summary.bookingIntent)
        assertTrue(runCatching { bookingRequestPayload(result.summary, null, 1) }.isFailure)
        assertNotNull(BookingIntentSnapshot.fromTripData(document))
    }
}
