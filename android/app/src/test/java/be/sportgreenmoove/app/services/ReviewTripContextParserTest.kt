package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class ReviewTripContextParserTest {
    private val context = mapOf("tripId" to "trip", "title" to "Entraînement U12", "departureAt" to "2026-10-29T17:45:00Z",
        "departureLabel" to "29 octobre 2026 à 18:45")
    @Test fun parsesTheActualContextWithoutChangingItsDateOrTitle() {
        val result = parseReviewTripContext(mapOf("tripContext" to context))!!
        assertEquals(context["title"], result.title); assertEquals(context["departureAt"], result.departureAt)
        assertEquals(context["departureLabel"], result.departureLabel); assertEquals("trip", result.tripId)
    }
    @Test fun acceptsExplicitUnavailableStateButNeverMissingMalformedOrPartialDetails() {
        assertNull(parseReviewTripContext(mapOf("tripContext" to null)))
        for (raw in listOf(emptyMap<String, Any>(), mapOf("tripContext" to false),
            mapOf("tripContext" to context - "title"), mapOf("tripContext" to context + ("extra" to true)),
            mapOf("tripContext" to context + ("tripId" to "foreign/path")),
            mapOf("tripContext" to context + ("departureAt" to "2026-10-29T17:45:00")),
            mapOf("tripContext" to context + ("title" to " ")))) {
            assertThrows(IllegalStateException::class.java) { parseReviewTripContext(raw) }
        }
    }
    @Test fun parsesTheSameContextFromInboxAndContinuationWithoutAcceptingAnotherReviewOwner() {
        val row = mapOf("id" to "ride_parent_driver", "rideSessionId" to "ride", "ratedUserId" to "driver", "title" to "Avis",
            "prompt" to "Votre avis ?", "initials" to "AV", "tripContext" to context)
        val raw = mapOf("userId" to "parent", "items" to listOf(row), "nextCursor" to null)
        assertEquals("trip", parsePendingReviewPage(raw, "parent").items.single().tripContext?.tripId)
        assertThrows(IllegalStateException::class.java) { parsePendingReviewPage(raw, "driver") }
    }
}
