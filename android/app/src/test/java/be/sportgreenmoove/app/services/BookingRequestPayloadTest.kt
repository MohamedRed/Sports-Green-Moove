package be.sportgreenmoove.app.services

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import be.sportgreenmoove.app.data.BookingIntentSnapshot
import be.sportgreenmoove.app.data.MapPoint
import be.sportgreenmoove.app.data.TripSummary

class BookingRequestPayloadTest {
    private val intent = BookingIntentSnapshot("2027-01-10T10:00:00.000Z", null,
        MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250, "driver", 4)
    private val trip = TripSummary("trip", "Trip", "Club", "U8", departureLabel = "10h00",
        seatsAvailable = 4, priceLabel = "2,50 EUR", reasons = emptyList(), bookingIntent = intent)
    @Test fun theSelectedSeatCountAndChildAreSentUnchanged() {
        for (seats in 1..3) assertEquals(mapOf("tripId" to "trip", "childId" to "child", "seats" to seats,
            "expectedBookingIntent" to intent.toCallablePayload()), bookingRequestPayload(trip, "child", seats))
    }
    @Test fun aChildlessRequestDoesNotInventAChild() {
        assertFalse(bookingRequestPayload(trip, null, 2).containsKey("childId"))
    }
    @Test fun invalidCapacityOrIdentifiersFailBeforeDispatch() {
        for (seats in listOf(-1, 0, 9)) assertTrue(runCatching { bookingRequestPayload(trip, null, seats) }.isFailure)
        assertTrue(runCatching { bookingRequestPayload(trip.copy(id = ""), null, 1) }.isFailure)
        assertTrue(runCatching { bookingRequestPayload(trip, " ", 1) }.isFailure)
    }
    @Test fun missingOrInvalidDisplayedTermsCannotBeDispatched() {
        assertTrue(runCatching { bookingRequestPayload(trip.copy(bookingIntent = null), null, 1) }.isFailure)
        assertTrue(runCatching { bookingRequestPayload(trip.copy(bookingIntent = intent.copy(priceCents = -1)), null, 1) }.isFailure)
    }
    @Test fun aLaterTripObjectCannotReplaceThePreviouslyDisplayedSnapshot() {
        val later = trip.copy(bookingIntent = intent.copy(priceCents = 900))
        assertEquals(intent.toCallablePayload(), bookingRequestPayload(trip, null, 2)["expectedBookingIntent"])
        assertEquals(later.bookingIntent!!.toCallablePayload(), bookingRequestPayload(later, null, 2)["expectedBookingIntent"])
    }
}
