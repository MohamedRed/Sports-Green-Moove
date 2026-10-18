package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class GuardianPageStateTest {
    @Test fun filteredEmptyPagesKeepTheContinuationAndDoNotPretendExhaustion() = runBlocking {
        val state = GuardianPageState({ cursor: String? -> if (cursor == null) GuardianPage(emptyList(), "next")
            else GuardianPage(listOf(GuardianOption("club", "Club QA")), null) }, GuardianOption::id)
        state.reload(); assertTrue(state.loaded); assertTrue(state.hasMore); assertTrue(state.items.isEmpty())
        state.more(); assertEquals("club", state.items.single().id); assertFalse(state.hasMore)
    }
    @Test fun repeatingCursorsAndDuplicateRowsClearThePageRatherThanSilentlyTruncate() = runBlocking {
        for (duplicate in listOf(true, false)) {
            val state = GuardianPageState({ cursor: String? -> GuardianPage(listOf(GuardianOption(if (cursor == null || duplicate) "first" else "second", "Club")), "next") }, GuardianOption::id)
            state.reload(); state.more(); assertNotNull(state.error); assertTrue(state.items.isEmpty()); assertFalse(state.loaded)
        }
    }
    @Test fun disposedPagesCannotPublishThePreviousAccountsResults() = runBlocking {
        val gate = CompletableDeferred<GuardianPage<GuardianOption>>()
        val state = GuardianPageState({ _: String? -> gate.await() }, GuardianOption::id)
        val pending = launch(start = CoroutineStart.UNDISPATCHED) { state.reload() }
        state.close(); gate.complete(GuardianPage(listOf(GuardianOption("private", "Old account")), null)); pending.join()
        assertTrue(state.items.isEmpty()); assertFalse(state.busy); assertFalse(state.loaded)
    }
}
