package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TeamConversationTarget
import org.junit.Assert.*
import org.junit.Test

class TeamConversationWireTest {
    private val target = TeamConversationTarget("team", "a".repeat(64))
    private val message = mapOf("id" to "b".repeat(64), "senderUserId" to "parent", "body" to "Message QA",
        "sequence" to 1, "createdAtSeconds" to 100, "createdAtNanos" to 123, "authorName" to "Parent QA",
        "requestId" to "12345678-1234-4234-8234-123456789abc")
    private val payload: Map<String, Any?> = mapOf("currentUserId" to "parent", "teamId" to "team",
        "teamInstanceId" to target.teamInstanceId, "accessVersion" to "c".repeat(64), "title" to "Équipe QA",
        "historyPolicy" to "after-current-admission", "items" to listOf(message), "nextCursor" to null)

    @Test fun responseBindsAccountTeamHistoryAndMessageRequestIdentity() {
        val page = TeamConversationWire.page(payload, "parent", target)
        assertEquals("Équipe QA", page.title); assertTrue(page.messages.single().mine)
        assertEquals(message["requestId"], page.messages.single().requestId); assertNull(page.olderCursor)
    }
    @Test fun anotherAccountTeamOrHistoryPolicyCannotProduceMessages() {
        for (change in listOf(mapOf("currentUserId" to "other"), mapOf("teamId" to "other"),
            mapOf("teamInstanceId" to "d".repeat(64)), mapOf("accessVersion" to "legacy"),
            mapOf("historyPolicy" to "all"), mapOf("title" to "bad\u202ename")))
            assertThrows(Exception::class.java) { TeamConversationWire.page(payload + change, "parent", target) }
    }
    @Test fun malformedMessagesAndDuplicateOrUnorderedPagesAreRejected() {
        for (change in listOf(mapOf("createdAtNanos" to 1_000_000_000), mapOf("sequence" to Double.NaN),
            mapOf("requestId" to "bad"), mapOf("body" to " "), mapOf("id" to "bad"), mapOf("senderUserId" to "bad/id")))
            assertThrows(Exception::class.java) { TeamConversationWire.page(payload + ("items" to listOf(message + change)), "parent", target) }
        for (rows in listOf(listOf(message, message), listOf(message, message + mapOf("id" to "d".repeat(64), "createdAtSeconds" to 101))))
            assertThrows(Exception::class.java) { TeamConversationWire.page(payload + ("items" to rows), "parent", target) }
    }
    @Test fun optionsBindCurrentAccountClubModeAndImmutableTeamIdentity() {
        val choices = mapOf("currentUserId" to "parent", "kind" to "teams", "clubId" to "club", "nextCursor" to null,
            "items" to listOf(mapOf("id" to "team", "name" to "Équipe QA", "teamInstanceId" to target.teamInstanceId)))
        assertEquals(target.teamInstanceId, TeamConversationWire.choices(choices, "parent", "club").items.single().teamInstanceId)
        assertThrows(Exception::class.java) { TeamConversationWire.choices(choices, "other", "club") }
        assertThrows(Exception::class.java) { TeamConversationWire.choices(choices, "parent", null) }
    }
    @Test fun aSendReceiptCannotConfirmAnotherAccountOrTeam() {
        val receipt = mapOf("currentUserId" to "parent", "teamInstanceId" to target.teamInstanceId,
            "messageId" to "b".repeat(64), "sequence" to 1, "reused" to true)
        assertEquals("b".repeat(64), TeamConversationWire.receipt(receipt, "parent", target))
        assertThrows(Exception::class.java) { TeamConversationWire.receipt(receipt, "other", target) }
        assertThrows(Exception::class.java) { TeamConversationWire.receipt(receipt + ("sequence" to 0), "parent", target) }
    }
}
