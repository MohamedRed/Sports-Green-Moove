package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ReservationDecision
import org.junit.Assert.*
import org.junit.Test

class ReservationPayloadsTest {
    private val row = mapOf("bookingId" to "booking", "tripId" to "trip", "parentUserId" to "parent",
        "seats" to 2, "status" to "requested", "title" to "Trajet QA", "club" to "Club QA",
        "dateLabel" to "16-10-2026", "timeLabel" to "16h00", "priceLabel" to "0,00 EUR",
        "allowedActions" to listOf("cancel"), "refundPending" to false)
    private fun page(item: Map<String, Any?>) = mapOf("items" to listOf(item), "nextCursor" to null)
    @Test fun decodesTheActualSeatCountStatusAndCapabilities() {
        val decoded = reservationPage(page(row)).items.single()
        assertEquals(2, decoded.booking.seats)
        assertEquals(setOf(ReservationDecision.Cancel), decoded.allowedActions)
        assertFalse(decoded.refundPending)
    }
    @Test fun missingFieldsDoNotInventRequestedStatusOrOneSeat() {
        for (field in listOf("bookingId", "tripId", "parentUserId", "seats", "status", "allowedActions", "refundPending", "title")) {
            assertThrows(ProviderConfigurationException::class.java) { reservationPage(page(row - field)) }
        }
    }
    @Test fun invalidCapabilitiesCountsAndPagingFailExplicitly() {
        for ((field, value) in listOf("seats" to 1.5, "seats" to 0, "status" to "unknown", "allowedActions" to listOf("unknown"))) {
            assertThrows(ProviderConfigurationException::class.java) { reservationPage(page(row + (field to value))) }
        }
        assertThrows(ProviderConfigurationException::class.java) { reservationPage(mapOf("items" to listOf(row, row), "nextCursor" to null)) }
        assertThrows(ProviderConfigurationException::class.java) { reservationPage(mapOf("items" to listOf(row), "nextCursor" to "")) }
    }
}
