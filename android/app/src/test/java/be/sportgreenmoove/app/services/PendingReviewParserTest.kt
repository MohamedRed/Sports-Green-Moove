package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class PendingReviewParserTest {
    private fun row(id: String = "ride_parent_driver") = mapOf("id" to id, "rideSessionId" to "ride", "ratedUserId" to "driver",
        "title" to "Avis", "prompt" to "Votre avis ?", "initials" to "AV")
    private fun page() = mapOf("userId" to "parent", "items" to listOf(row()), "nextCursor" to "next_1")
    @Test fun parsesEmptyContinuationAndTerminalPagesSeparately() {
        assertEquals("next_1", parsePendingReviewPage(page() + ("items" to emptyList<Any>()), "parent").nextCursor)
        assertNull(parsePendingReviewPage(page() + ("nextCursor" to null), "parent").nextCursor)
    }
    @Test fun rejectsWrongOwnerMissingCursorMalformedRowsDuplicatesAndUnknownFields() {
        val invalid = listOf(page() + ("userId" to "driver"), page() - "nextCursor", page() + ("nextCursor" to "bad/cursor"),
            page() + ("items" to listOf(row("forged"))), page() + ("items" to listOf(row(), row())),
            page() + ("items" to listOf(row() - "prompt")), page() + ("unexpected" to true),
            page() + ("items" to List(21) { row() }), page() + ("items" to listOf(null)))
        invalid.forEach { raw -> assertThrows(IllegalStateException::class.java) { parsePendingReviewPage(raw, "parent") } }
    }
}
