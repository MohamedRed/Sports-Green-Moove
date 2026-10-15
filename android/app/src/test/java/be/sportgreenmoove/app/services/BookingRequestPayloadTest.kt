package be.sportgreenmoove.app.services

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingRequestPayloadTest {
    @Test fun theSelectedSeatCountAndChildAreSentUnchanged() {
        for (seats in 1..3) assertEquals(mapOf("tripId" to "trip", "childId" to "child", "seats" to seats),
            bookingRequestPayload("trip", "child", seats))
    }
    @Test fun aChildlessRequestDoesNotInventAChild() {
        assertFalse(bookingRequestPayload("trip", null, 2).containsKey("childId"))
    }
    @Test fun invalidCapacityOrIdentifiersFailBeforeDispatch() {
        for (seats in listOf(-1, 0, 9)) assertTrue(runCatching { bookingRequestPayload("trip", null, seats) }.isFailure)
        assertTrue(runCatching { bookingRequestPayload("", null, 1) }.isFailure)
        assertTrue(runCatching { bookingRequestPayload("trip", " ", 1) }.isFailure)
    }
}
