package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ReceivedRatingSummary
import org.junit.Assert.*
import org.junit.Test

class ReceivedRatingsParserTest {
    private fun row(count: Any? = 104, average: Any? = 358.0 / 104) =
        mapOf("userId" to "driver", "count" to count, "average" to average)
    @Test fun emptyAndPopulatedResponsesRemainDistinct() {
        assertEquals(ReceivedRatingSummary("driver", 0, null), parseReceivedRatingSummary(row(0, null), "driver"))
        assertEquals(ReceivedRatingSummary("driver", 104, 358.0 / 104), parseReceivedRatingSummary(row(), "driver"))
    }
    @Test fun anotherAccountsSummaryAndUnexpectedFieldsAreRejected() {
        for (data in listOf(row() + ("userId" to "parent"), row() + ("comments" to emptyList<String>()), row() - "count",
            row() - "average", row() - "userId", null, listOf(1))) {
            assertTrue(runCatching { parseReceivedRatingSummary(data, "driver") }.isFailure)
        }
    }
    @Test fun invalidCountsAndAveragesAreNeverRepairedOrClamped() {
        for ((count, average) in listOf(-1 to null, 0 to 5, 0 to 0, 1 to null, 1 to Double.NaN, 1 to Double.POSITIVE_INFINITY,
            1 to 0, 1 to 6, 1 to "4", 1.1 to 4, "2" to 4, Double.POSITIVE_INFINITY to 4, 9_007_199_254_740_992L to 4)) {
            assertTrue(runCatching { parseReceivedRatingSummary(row(count, average), "driver") }.isFailure)
        }
    }
}
