package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ConversationBookingStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ConversationDirectoryMappersTest {
    private val id = "a".repeat(64)
    private fun row() = mapOf("id" to id, "sourceType" to "booking", "sourceId" to "b1", "title" to "Trajet de Lina",
        "preview" to "Au stade.", "dateLabel" to "15-10-2026", "departureLabel" to "16-10-2026 · 18h00",
        "peerLabel" to "Conducteur QA", "childLabel" to null, "unreadCount" to 120L, "revision" to 3L,
        "lastMessageSeconds" to 100L, "lastMessageNanos" to 12, "bookingStatus" to "approved")
    private fun directory(item: Map<String, Any?> = row()) = mapOf("items" to listOf(item), "nextCursor" to null,
        "newest" to mapOf("seconds" to 100L, "nanos" to 12, "id" to id),
        "oldest" to mapOf("seconds" to 100L, "nanos" to 12, "id" to id), "excludedIds" to emptyList<String>())

    @Test fun parsesFullUnreadCountsAndActualTripContext() {
        val parsed = mapConversationDirectory(directory()).items.single()
        assertEquals(120L, parsed.unreadCount)
        assertEquals("Conducteur QA", parsed.peerLabel)
        assertEquals("16-10-2026 · 18h00", parsed.tripLabel)
        val booking = mapConversationBookings(mapOf("items" to listOf(row()), "nextCursor" to null)).items.single()
        assertEquals(ConversationBookingStatus.Approved, booking.status)
        assertEquals(parsed.tripLabel, booking.dateLabel)
    }

    @Test fun rejectsMalformedResponsesInsteadOfInventingAnEmptyInboxOrDefaultOwner() {
        for (change in listOf(mapOf("unreadCount" to -1), mapOf("unreadCount" to 0.5), mapOf("revision" to 0),
            mapOf("lastMessageNanos" to 1_000_000_000), mapOf("sourceType" to "trip"), mapOf("title" to ""),
            mapOf("departureLabel" to null), mapOf("sourceId" to "a/b"), mapOf("peerLabel" to 12))) {
            assertThrows(Exception::class.java) { mapConversationDirectory(directory(row() + change)) }
        }
        assertThrows(Exception::class.java) { mapConversationDirectory(mapOf("items" to "invalid")) }
        assertThrows(Exception::class.java) { mapConversationBookings(mapOf("items" to listOf(row() + ("bookingStatus" to "unknown")), "nextCursor" to null)) }
    }
}
