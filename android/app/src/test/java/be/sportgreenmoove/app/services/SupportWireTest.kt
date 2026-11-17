package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.SupportStatus
import org.junit.Assert.*
import org.junit.Test

class SupportWireTest {
    private val reply = mapOf("id" to "a".repeat(64), "text" to "Votre réponse.", "sequence" to 1, "sentAtMillis" to 2000)
    private val report = mapOf("id" to "ticket", "reason" to "Trajet", "description" to "Une demande de support.", "emergency" to false,
        "status" to "closed", "createdAtMillis" to 1000, "updatedAtMillis" to 2000, "replyCount" to 1, "lastReply" to reply)
    private fun invalid(action: () -> Unit) { try { action(); fail("Expected invalid support response") } catch (_: IllegalStateException) {} catch (_: IllegalArgumentException) {} }
    @Test fun responseAndStatusAreDecodedWithoutPrivateMetadata() {
        val row = SupportWire.report(report + mapOf("reviewNote" to "PRIVATE", "reviewedByUserId" to "staff"))
        assertEquals(SupportStatus.Closed, row.status); assertEquals("Votre réponse.", row.lastReply?.text)
        val detail = SupportWire.detail(mapOf("report" to report, "replies" to mapOf("items" to listOf(reply), "nextCursor" to null)), "ticket")
        assertEquals(1, detail.replies.items.size)
    }
    @Test fun malformedNumbersStatusesRepliesAndPagesAreRejected() {
        for (patch in listOf(mapOf("status" to "unknown"), mapOf("replyCount" to -1), mapOf("replyCount" to true),
            mapOf("replyCount" to 0.5), mapOf("lastReply" to null), mapOf("updatedAtMillis" to 0))) invalid { SupportWire.report(report + patch) }
        invalid { SupportWire.reports(mapOf("items" to listOf(report, report), "nextCursor" to null)) }
        invalid { SupportWire.reports(mapOf("items" to emptyList<Any>())) }
        invalid { SupportWire.detail(mapOf("report" to report, "replies" to mapOf("items" to listOf(reply), "nextCursor" to null)), "foreign") }
    }
}
