package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripChangeStatus
import org.junit.Assert.*
import org.junit.Test

class TripChangeHistoryMappingTest {
    private val entry = mapOf("tripId" to "trip", "proposalId" to "a".repeat(64), "status" to "declined",
        "createdAt" to "2026-10-17T12:00:00.000Z", "departureAt" to "2026-12-01T12:00:00.000Z", "priceCents" to 400)
    private fun page(items: Any? = listOf(entry), cursor: Any? = null) = mapOf("tripId" to "trip", "items" to items, "nextCursor" to cursor)
    @Test fun retainsClosedProposalIdentityAndDoesNotInventAnEmptyPage() {
        val result = tripHistoryPage(page(cursor = "next_page"), "trip")
        assertEquals(TripChangeStatus.Declined, result.items.single().status)
        assertEquals("a".repeat(64), result.items.single().proposalId)
        assertEquals(400, result.items.single().priceCents)
        assertEquals("next_page", result.nextCursor)
        assertTrue(tripHistoryPage(page(items = emptyList<Any>()), "trip").items.isEmpty())
    }
    @Test fun malformedOrForeignRowsFailRatherThanDisappearing() {
        for (patch in listOf(mapOf("tripId" to "other"), mapOf("proposalId" to "bad"), mapOf("status" to "unknown"),
            mapOf("createdAt" to "yesterday"), mapOf("departureAt" to null), mapOf("priceCents" to -1), mapOf("priceCents" to 2.5))) {
            assertThrows(Exception::class.java) { tripHistoryPage(page(items = listOf(entry + patch)), "trip") }
        }
        for (invalid in listOf(page(items = "bad"), page(items = listOf(entry, entry)), page(items = List(11) { entry }),
            page(cursor = "not a cursor"), page(cursor = false), page(items = emptyList<Any>(), cursor = "next"),
            page() - "nextCursor", page() + ("tripId" to "other"))) {
            assertThrows(Exception::class.java) { tripHistoryPage(invalid, "trip") }
        }
    }
}
