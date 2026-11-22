package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TripChangeGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class TripChangeHistoryStateTest {
    private val entry = TripChangeHistoryEntry("trip", "a".repeat(64), TripChangeStatus.Declined,
        "2026-10-17T12:00:00Z", "2026-12-01T12:00:00Z", 400)
    private class Gateway : TripChangeGateway by ChangeGateway() {
        val cursors = mutableListOf<String?>()
        var action: suspend (String?) -> TripChangeHistoryPage = { error("Unexpected call") }
        override suspend fun tripChangeHistory(tripId: String, cursor: String?): TripChangeHistoryPage {
            cursors += cursor; return action(cursor)
        }
    }

    @Test fun pagesAreExplicitAndRefreshStartsAtTheFirstPage() = runBlocking {
        val gateway = Gateway()
        gateway.action = { TripChangeHistoryPage("trip", listOf(entry), "next") }
        val state = TripChangeHistoryState("trip", gateway)
        state.more(); assertTrue(gateway.cursors.isEmpty())
        state.reload(); assertTrue(state.loaded); assertTrue(state.hasMore)
        gateway.action = { TripChangeHistoryPage("trip", listOf(entry.copy(proposalId = "b".repeat(64))), null) }
        state.more(); assertEquals(2, state.items.size); assertFalse(state.hasMore)
        assertEquals(listOf(null, "next"), gateway.cursors)
        state.reload(); assertEquals(1, state.items.size); assertNull(gateway.cursors.last())
    }

    @Test fun errorDoesNotLeaveStaleHistoryOrPretendTheListIsEmpty() = runBlocking {
        val gateway = Gateway(); val state = TripChangeHistoryState("trip", gateway)
        gateway.action = { TripChangeHistoryPage("trip", listOf(entry), "next") }; state.reload()
        gateway.action = { throw IOException() }; state.more()
        assertFalse(state.loaded); assertTrue(state.items.isEmpty()); assertFalse(state.hasMore); assertNotNull(state.error)
        state.more(); assertEquals(2, gateway.cursors.size)
        gateway.action = { TripChangeHistoryPage("trip", emptyList(), null) }; state.reload()
        assertTrue(state.loaded); assertNull(state.error)
    }

    @Test fun wrongTripRepeatedPageAndDuplicateProposalsFailClosed() = runBlocking {
        for (page in listOf(TripChangeHistoryPage("other", listOf(entry), null),
            TripChangeHistoryPage("trip", listOf(entry.copy(tripId = "other")), null),
            TripChangeHistoryPage("trip", listOf(entry, entry), null),
            TripChangeHistoryPage("trip", emptyList(), "next"))) {
            val gateway = Gateway(); gateway.action = { page }
            val state = TripChangeHistoryState("trip", gateway); state.reload()
            assertFalse(state.loaded); assertTrue(state.items.isEmpty()); assertNotNull(state.error)
        }
        val gateway = Gateway(); gateway.action = { TripChangeHistoryPage("trip", listOf(entry), "next") }
        val state = TripChangeHistoryState("trip", gateway); state.reload(); state.more()
        assertNotNull(state.error); assertTrue(state.items.isEmpty())
    }

    @Test fun closingAnAccountScopeDiscardsLateResponsesAndNeverLoadsAgain() = runBlocking {
        val released = CompletableDeferred<TripChangeHistoryPage>()
        val gateway = Gateway(); gateway.action = { released.await() }
        val state = TripChangeHistoryState("trip", gateway)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.reload() }
        assertTrue(state.busy); state.close()
        released.complete(TripChangeHistoryPage("trip", listOf(entry), null)); job.join()
        assertTrue(state.items.isEmpty()); assertFalse(state.loaded || state.busy); assertNull(state.error)
        state.reload(); state.more(); assertEquals(1, gateway.cursors.size)
    }
}
