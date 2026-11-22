package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.services.NotificationInboxGateway
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationInboxStateTest {
    private val first = InboxNotificationSummary("teamChat_one", "Nouveau message d’équipe", "Avis QA", "1 novembre", true, "NM")
    private val second = first.copy(id = "teamChat_two")
    private fun state(gateway: NotificationInboxGateway) = NotificationInboxState("parent", gateway) {}

    @Test fun primaryPollingAddsAndRemovesRowsWithoutDuplicatesWhileActive() = runTest {
        val gateway = Fixture().apply { rows = listOf(first) }; val state = state(gateway)
        val job = launch { state.observe() }; runCurrent()
        assertEquals(listOf(first), state.items); assertFalse(state.loading)
        gateway.rows = listOf(second, first); advanceTimeBy(4_000); runCurrent()
        assertEquals(listOf(second, first), state.items)
        advanceTimeBy(4_000); runCurrent(); assertEquals(2, state.items.size)
        gateway.rows = emptyList(); advanceTimeBy(4_000); runCurrent()
        assertTrue(state.items.isEmpty()); assertNull(state.error); assertEquals(List(4) { "parent" }, gateway.users)
        job.cancelAndJoin(); assertTrue(state.items.isEmpty()); assertTrue(state.loading)
        advanceTimeBy(20_000); runCurrent(); assertEquals(4, gateway.users.size)
    }
    @Test fun anUnverifiedReadHidesExistingRowsAndRequiresExplicitRetry() = runTest {
        val gateway = Fixture().apply { rows = listOf(first) }; val state = state(gateway)
        var job = launch { state.observe() }; runCurrent(); gateway.fail = true
        advanceTimeBy(4_000); runCurrent()
        assertTrue(state.items.isEmpty()); assertNotNull(state.error); assertFalse(state.loading)
        gateway.fail = false; gateway.rows = listOf(second)
        advanceTimeBy(20_000); runCurrent(); assertEquals(2, gateway.users.size); assertTrue(state.items.isEmpty())
        job.cancelAndJoin(); job = launch { state.observe() }; runCurrent()
        assertEquals(listOf(second), state.items); assertNull(state.error)
        job.cancelAndJoin()
    }
    @Test fun explicitSuccessfulRetryResumesPollingButFailedRetryDoesNot() = runTest {
        val gateway = Fixture().apply { rows = listOf(first) }; val state = state(gateway)
        val job = launch { state.observe() }; runCurrent()
        gateway.fail = true; advanceTimeBy(4_000); runCurrent(); state.refresh()
        assertEquals(3, gateway.users.size); assertTrue(state.items.isEmpty())
        advanceTimeBy(20_000); runCurrent(); assertEquals(3, gateway.users.size)
        gateway.fail = false; state.refresh(); runCurrent(); assertEquals(listOf(first), state.items)
        gateway.rows = listOf(second); advanceTimeBy(4_000); runCurrent()
        assertEquals(listOf(second), state.items); assertEquals(5, gateway.users.size)
        job.cancelAndJoin(); assertTrue(state.items.isEmpty())
    }
    @Test fun pauseClearsPrivateRowsAndRejectsAnUncooperativeLateResponse() = runTest {
        val gateway = Fixture().apply { rows = listOf(first); gate = CompletableDeferred() }
        val held = gateway.gate!!; val state = state(gateway)
        val old = launch { state.refresh() }; runCurrent(); state.pause()
        assertTrue(state.items.isEmpty()); assertTrue(state.loading)
        gateway.rows = listOf(second); state.refresh(); assertEquals(listOf(second), state.items)
        held.complete(Unit); old.join(); assertEquals(listOf(second), state.items)
    }
    @Test fun pauseRejectsAnUncooperativeLateFailureWithoutHidingTheNewResult() = runTest {
        val gateway = Fixture().apply { fail = true; gate = CompletableDeferred() }; val held = gateway.gate!!
        val state = state(gateway); val old = launch { state.refresh() }; runCurrent(); state.pause()
        gateway.fail = false; gateway.rows = listOf(second); state.refresh()
        held.complete(Unit); old.join(); assertEquals(listOf(second), state.items); assertNull(state.error)
    }
    @Test fun accountDisposalIgnoresLateRowsAndCannotStartAnotherRead() = runTest {
        val gateway = Fixture().apply { rows = listOf(first); gate = CompletableDeferred() }; val held = gateway.gate!!
        val state = state(gateway); val job = launch { state.refresh() }; runCurrent(); state.close()
        held.complete(Unit); job.join(); state.refresh(); state.observe()
        assertTrue(state.items.isEmpty()); assertEquals(1, gateway.users.size); assertNull(state.error)
        assertTrue(state(gateway).items.isEmpty())
    }
    @Test fun overlappingReadsDoNotDuplicateRequestsAndCancellationCannotPublish() = runTest {
        val gateway = Fixture().apply { rows = listOf(first); gate = CompletableDeferred() }; val held = gateway.gate!!
        val state = state(gateway); val job = launch { state.refresh() }; runCurrent(); state.refresh()
        assertEquals(1, gateway.users.size); job.cancel(); held.complete(Unit); job.join()
        assertTrue(state.items.isEmpty()); assertNull(state.error)
    }
    @Test fun onlySuccessfulCurrentRowsReachReadReconciliation() = runTest {
        val gateway = Fixture().apply { rows = listOf(first.copy(unread = false)) }; val observed = mutableListOf<List<InboxNotificationSummary>>()
        val state = NotificationInboxState("parent", gateway) { observed += it }
        state.refresh(); gateway.fail = true; state.refresh()
        assertEquals(listOf(listOf(first.copy(unread = false))), observed); assertTrue(state.items.isEmpty())
    }
    private class Fixture : NotificationInboxGateway {
        var rows = emptyList<InboxNotificationSummary>(); var fail = false; var gate: CompletableDeferred<Unit>? = null
        val users = mutableListOf<String>()
        override suspend fun loadNotificationInbox(uid: String): List<InboxNotificationSummary> {
            users += uid; val current = rows; val rejected = fail; val held = gate; gate = null
            if (held != null) withContext(NonCancellable) { held.await() }
            check(!rejected) { "Synthetic authority read failure" }
            return current
        }
    }
}
