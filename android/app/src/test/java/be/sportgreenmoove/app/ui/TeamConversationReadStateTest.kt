package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class TeamConversationReadStateTest {
    private val target = TeamConversationTarget("team", "a".repeat(64))
    @Test fun onlyVisibleIncomingUnreadRowsAreAcknowledgedAndOnlyAfterConfirmation() = runBlocking {
        val gateway = Fixture(); val state = TeamConversationState("parent", target, gateway); state.refresh()
        gateway.hold = CompletableDeferred()
        val read = launch(start = CoroutineStart.UNDISPATCHED) { state.markVisibleRead(listOf("one", "mine", "already", "foreign")) }
        assertEquals(listOf(listOf("one")), gateway.calls); assertTrue(state.messages.single { it.id == "one" }.needsRead)
        state.markVisibleRead(listOf("one")); assertEquals(1, gateway.calls.size)
        gateway.hold!!.complete(Unit); read.join()
        assertFalse(state.messages.single { it.id == "one" }.needsRead); assertTrue(state.messages.single { it.id == "two" }.needsRead)
        state.refresh(); assertFalse(state.messages.single { it.id == "one" }.needsRead)
    }
    @Test fun failedReadRemainsUnreadUntilAnExplicitRetrySucceeds() = runBlocking {
        val gateway = Fixture().apply { failRead = true }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        state.markVisibleRead(listOf("one")); assertNotNull(state.readError); assertNull(state.error)
        assertTrue(state.messages.single { it.id == "one" }.needsRead)
        gateway.failRead = false; state.markVisibleRead(listOf("one"))
        assertNull(state.readError); assertFalse(state.messages.single { it.id == "one" }.needsRead); assertEquals(2, gateway.calls.size)
    }
    @Test fun rejectedReadAuthorityRemovesAllPrivateRowsAndTheTitle() = runBlocking {
        val gateway = Fixture().apply { rejectRead = true }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        state.markVisibleRead(listOf("one")); assertTrue(state.messages.isEmpty()); assertNull(state.title); assertNotNull(state.error)
        state.markVisibleRead(listOf("two")); assertEquals(1, gateway.calls.size)
    }
    @Test fun anUnknownReadReplyIsReconciledByFreshServerFlagsWithoutAnotherWrite() = runBlocking {
        val gateway = Fixture().apply { loseReadReply = true }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        state.markVisibleRead(listOf("one")); assertNotNull(state.readError)
        assertTrue(state.messages.single { it.id == "one" }.needsRead)
        state.refresh(); assertNull(state.readError); assertFalse(state.messages.single { it.id == "one" }.needsRead)
        state.markVisibleRead(listOf("one")); assertEquals(1, gateway.calls.size)
    }
    @Test fun aPartialPageCannotClearUnconfirmedReadsThatItDoesNotConfirm() = runBlocking {
        val gateway = Fixture().apply { failRead = true }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        state.markVisibleRead(listOf("one", "two")); assertNotNull(state.readError)
        gateway.serverReads.add("one"); gateway.returnedIds = setOf("one", "mine", "already")
        state.refresh(); assertNotNull(state.readError); assertTrue(state.messages.single { it.id == "two" }.needsRead)
        gateway.serverReads.add("two"); gateway.returnedIds = null; state.refresh()
        assertNull(state.readError); assertEquals(1, gateway.calls.size)
    }
    @Test fun aLateLostReplyCannotRestoreAnErrorAfterTheServerHasAlreadyConfirmedTheRead() = runBlocking {
        val gateway = Fixture().apply { hold = CompletableDeferred(); loseReadReply = true }
        val state = TeamConversationState("parent", target, gateway); state.refresh()
        val read = launch(start = CoroutineStart.UNDISPATCHED) { state.markVisibleRead(listOf("one")) }
        gateway.serverReads.add("one"); state.refresh(); gateway.hold!!.complete(Unit); read.join()
        assertNull(state.readError); assertFalse(state.messages.single { it.id == "one" }.needsRead)
        assertEquals(1, gateway.calls.size)
    }
    @Test fun aLateReadCannotAcknowledgeANewAdmissionWindow() = runBlocking {
        val gateway = Fixture().apply { hold = CompletableDeferred() }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        val read = launch(start = CoroutineStart.UNDISPATCHED) { state.markVisibleRead(listOf("one")) }
        gateway.version = "d".repeat(64); state.refresh(); gateway.hold!!.complete(Unit); read.join()
        assertTrue(state.messages.single { it.id == "one" }.needsRead)
        assertEquals(listOf("b".repeat(64)), gateway.versions)
    }
    @Test fun backgroundingOrSwitchingAccountsDoesNotKeepReadStateOrApplyALateReply() = runBlocking {
        val gateway = Fixture().apply { hold = CompletableDeferred() }; val state = TeamConversationState("parent", target, gateway); state.refresh()
        val read = launch(start = CoroutineStart.UNDISPATCHED) { state.markVisibleRead(listOf("one")) }
        state.clear(); gateway.hold!!.complete(Unit); read.join(); assertTrue(state.messages.isEmpty()); assertNull(state.readError)
        state.refresh(); assertTrue(state.messages.single { it.id == "one" }.needsRead)
        val other = TeamConversationState("other", target, gateway); other.refresh(); assertTrue(other.messages.single { it.id == "one" }.needsRead)
    }
    private class Fixture : TeamConversationGateway {
        var version = "b".repeat(64); var hold: CompletableDeferred<Unit>? = null; var failRead = false; var rejectRead = false
        var loseReadReply = false; var returnedIds: Set<String>? = null; val serverReads = mutableSetOf<String>()
        val calls = mutableListOf<List<String>>(); val versions = mutableListOf<String>()
        override suspend fun choices(uid: String, clubId: String?, cursor: String?) = GuardianPage<TeamChatChoice>(emptyList(), null)
        override suspend fun messages(uid: String, target: TeamConversationTarget, cursor: String?) = TeamConversationPage("Équipe QA", version,
            listOf(ConversationMessage("one", "Premier message QA", false, 4, needsRead = "one" !in serverReads),
                ConversationMessage("two", "Second message QA", false, 3, needsRead = "two" !in serverReads),
                ConversationMessage("mine", "Mon message QA", true, 2), ConversationMessage("already", "Déjà lu QA", false, 1))
                .filter { returnedIds == null || it.id in returnedIds!! }, null)
        override suspend fun send(uid: String, target: TeamConversationTarget, body: String, requestId: String): String = error("No send in read tests")
        override suspend fun markRead(uid: String, target: TeamConversationTarget, accessVersion: String, messageIds: List<String>) {
            calls += messageIds; versions += accessVersion; hold?.await()
            if (rejectRead) throw TeamConversationReadRejectedException(IllegalStateException("Explicit revoked-authority fixture"))
            check(!failRead) { "Explicit unavailable-read fixture" }
            if (loseReadReply) { serverReads.addAll(messageIds); error("Explicit committed-read/lost-reply fixture") }
        }
    }
}
