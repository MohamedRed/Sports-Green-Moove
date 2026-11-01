package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class NotificationInboxWireTest {
    private val notice = mapOf("id" to "teamChat_notice", "title" to "Nouveau message d’équipe", "body" to "Avis QA",
        "dateLabel" to "1 novembre", "unread" to true, "initials" to "NM")
    private fun receipt(rows: List<Any?> = listOf(notice)) = mapOf("userId" to "parent", "notifications" to rows)
    @Test fun currentAccountGetsExactlyTheAuthoritativeRowsIncludingConfirmedEmpty() {
        val rows = parseNotificationInbox(receipt(), "parent")
        assertEquals(1, rows.size); assertTrue(rows[0].unread); assertEquals("teamChat_notice", rows[0].id)
        assertTrue(parseNotificationInbox(receipt(emptyList()), "parent").isEmpty())
    }
    @Test fun foreignMissingExtraOrMalformedMetadataIsRejectedRatherThanInventedEmpty() {
        for (value in listOf(null, emptyMap<String,Any>(), receipt()+mapOf("userId" to "other"),
            receipt()+mapOf("cursor" to "old"), mapOf("userId" to "parent", "notifications" to null),
            receipt(listOf(notice, notice)), receipt(List(21) { notice }), receipt(listOf(null)))) rejected(value)
        for (change in listOf(mapOf("unread" to "false"), mapOf("id" to "bad/path"), mapOf("id" to ".."),
            mapOf("body" to null), mapOf("privateText" to "not allowed"))) rejected(receipt(listOf(notice+change)))
        rejected(receipt(listOf(notice-"title"))); rejected(receipt(), "")
    }
    private fun rejected(value: Any?, uid: String = "parent") {
        try { parseNotificationInbox(value,uid); fail("Malformed or foreign inbox must fail closed") }
        catch (_: IllegalStateException) { }
    }
}
