package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamConversationGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class TeamConversationStateTest {
    private val target = TeamConversationTarget("team", "a".repeat(64))
    @Test fun olderHistoryRemainsOnlyWhileTheAdmissionVersionIsUnchanged() = runBlocking {
        val gateway = Fixture(); val state = TeamConversationState("parent", target, gateway)
        state.refresh(); state.earlier(); assertEquals(setOf("new", "old"), state.messages.map { it.id }.toSet())
        gateway.version = "d".repeat(64); state.refresh()
        assertEquals(listOf("new"), state.messages.map { it.id }); assertEquals(0, gateway.sends)
    }
    @Test fun revokedOrUnreachableAuthorityHidesEveryCachedMessageAndTitle() = runBlocking {
        val gateway = Fixture(); val state = TeamConversationState("parent", target, gateway)
        state.refresh(); state.earlier(); gateway.deny = true; state.refresh()
        assertTrue(state.messages.isEmpty()); assertNull(state.title); assertFalse(state.hasEarlier); assertNotNull(state.error)
        state.earlier(); assertTrue(state.messages.isEmpty()); assertEquals(0, gateway.sends)
    }
    @Test fun anOlderPageFromChangedAdmissionClearsTheThreadInsteadOfMergingPrivateHistory() = runBlocking {
        val gateway = Fixture(); val state = TeamConversationState("parent", target, gateway)
        state.refresh(); gateway.version = "d".repeat(64); state.earlier()
        assertTrue(state.messages.isEmpty()); assertNull(state.title); assertNotNull(state.error)
    }
    @Test fun backgroundingIgnoresLateRepliesAndASeparateAccountStartsWithoutPrivateRows() = runBlocking {
        val gateway = Fixture().apply { held = CompletableDeferred() }; val state = TeamConversationState("parent", target, gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }
        state.clear(); gateway.held!!.complete(Unit); request.join()
        assertTrue(state.messages.isEmpty()); assertNull(state.title)
        val other = TeamConversationState("other", target, gateway); other.refresh()
        assertTrue(other.messages.isEmpty()); assertNotNull(other.error)
    }
    @Test fun concurrentReadsDoNotDuplicateLoadsAndFailureDoesNotWrite() = runBlocking {
        val gateway = Fixture().apply { held = CompletableDeferred() }; val state = TeamConversationState("parent", target, gateway)
        val request = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }; state.refresh()
        assertEquals(1, gateway.reads); gateway.held!!.complete(Unit); request.join(); assertEquals(0, gateway.sends)
    }
    private class Fixture : TeamConversationGateway {
        var version = "c".repeat(64); var deny = false; var held: CompletableDeferred<Unit>? = null; var reads = 0; var sends = 0
        override suspend fun choices(uid: String, clubId: String?, cursor: String?) = GuardianPage<TeamChatChoice>(emptyList(), null)
        override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?): TeamConversationPage {
            reads++; held?.await(); check(uid == "parent" && !deny)
            return TeamConversationPage("Équipe privée QA", version,
                listOf(ConversationMessage(if (cursor == null) "new" else "old", "Message privé QA", false,
                    if (cursor == null) 200 else 100)), if (cursor == null) "older" else null)
        }
        override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String { sends++; return "id" }
    }
}
