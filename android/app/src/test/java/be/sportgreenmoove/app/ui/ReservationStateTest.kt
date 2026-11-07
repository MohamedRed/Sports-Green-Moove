package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.ReservationGateway
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.*
import org.junit.Test

class ReservationStateTest {
    private val pending = ReservationItem(BookingRequestSummary("booking", "trip", "parent", null, "Enfant QA", 2,
        null, "requested", "Trajet QA", "Club QA", "16-10-2026", "16h00", "0,00 EUR"),
        setOf(ReservationDecision.Approve, ReservationDecision.Decline), false)
    private class Gateway : ReservationGateway {
        var loads = 0
        var writes = 0
        var read: suspend (String?) -> ReservationPage = { ReservationPage(emptyList(), null) }
        var write: suspend () -> Unit = {}
        override suspend fun list(role: AppRole, cursor: String?): ReservationPage { loads++; return read(cursor) }
        override suspend fun decide(bookingId: String, decision: ReservationDecision) { writes++; write() }
    }
    private fun gateway() = Gateway().apply { read = { ReservationPage(listOf(pending), null) } }

    @Test fun initialLoadingIsNotACompletedEmptyHistory() = runBlocking {
        val state = ReservationState(Gateway(), AppRole.Parent)
        assertFalse(state.loaded)
        state.reload()
        assertTrue(state.loaded && state.items.isEmpty())
        state.close()
        assertFalse(state.loaded)
    }

    @Test fun confirmedDecisionReloadsServerStateAndRefreshesTheApp() = runBlocking {
        val gateway = gateway()
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        val approved = pending.copy(booking = pending.booking.copy(status = "approved"), allowedActions = emptySet())
        gateway.write = { gateway.read = { ReservationPage(listOf(approved), null) } }
        var changed = 0
        state.decide(pending, ReservationDecision.Approve) { changed++ }
        assertEquals(1, gateway.writes)
        assertEquals(listOf(approved), state.items)
        assertEquals("Demande approuvée.", state.notice)
        assertEquals(1, changed)
        assertFalse(state.acting || state.requiresReload)
    }

    @Test fun absentItemsAndUnavailableActionsNeverDispatch() = runBlocking {
        val gateway = gateway()
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        state.decide(pending.copy(booking = pending.booking.copy(bookingId = "foreign")), ReservationDecision.Approve) { fail() }
        state.decide(pending, ReservationDecision.Cancel) { fail() }
        assertEquals(0, gateway.writes)
        assertNotNull(state.error)
    }

    @Test fun concurrentTapsCannotDispatchAnotherDecision() = runBlocking {
        val gateway = gateway()
        val reply = CompletableDeferred<Unit>()
        gateway.write = { reply.await() }
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        val first = launch(start = CoroutineStart.UNDISPATCHED) { state.decide(pending, ReservationDecision.Approve) {} }
        state.decide(pending, ReservationDecision.Decline) { fail() }
        state.reload()
        assertEquals(1, gateway.writes)
        assertEquals(1, gateway.loads)
        reply.complete(Unit)
        first.join()
    }

    @Test fun uncertainDecisionRequiresExplicitReloadBeforeAnyRetry() = runBlocking {
        val gateway = gateway()
        gateway.write = { error("uncertain transport") }
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        state.decide(pending, ReservationDecision.Decline) { fail() }
        assertTrue(state.requiresReload)
        assertNull(state.notice)
        state.decide(pending, ReservationDecision.Decline) { fail() }
        assertEquals(1, gateway.writes)
        state.reload()
        assertFalse(state.requiresReload)
    }

    @Test fun acknowledgedWriteWithFailedReloadIsNotReportedAsAnUnconfirmedWrite() = runBlocking {
        val gateway = gateway()
        gateway.write = { gateway.read = { error("reload unavailable") } }
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        state.decide(pending, ReservationDecision.Decline) { fail() }
        assertEquals("Demande refusée.", state.notice)
        assertTrue(state.items.isEmpty() && state.requiresReload)
        assertEquals("Décision enregistrée. Actualisez pour revoir la liste.", state.error)
    }

    @Test fun closingSuppressesALateReadAndItsAppCallback() = runBlocking {
        val gateway = gateway()
        val reply = CompletableDeferred<ReservationPage>()
        gateway.read = { withContext(NonCancellable) { reply.await() } }
        val state = ReservationState(gateway, AppRole.Parent)
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.reload { fail() } }
        state.close()
        reply.complete(ReservationPage(listOf(pending), null))
        job.join()
        assertTrue(state.items.isEmpty())
        assertFalse(state.loading || state.acting)
        assertNull(state.error)
    }

    @Test fun closingSuppressesALateWriteAndRefresh() = runBlocking {
        val gateway = gateway()
        val reply = CompletableDeferred<Unit>()
        gateway.write = { withContext(NonCancellable) { reply.await() } }
        val state = ReservationState(gateway, AppRole.Driver)
        state.reload()
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.decide(pending, ReservationDecision.Approve) { fail() } }
        state.close()
        reply.complete(Unit)
        job.join()
        assertEquals(1, gateway.loads)
        assertTrue(state.items.isEmpty())
        assertNull(state.notice)
    }

    @Test fun reloadingInvalidatesAnOlderPageThatIgnoresCancellation() = runBlocking {
        val gateway = gateway()
        gateway.read = { ReservationPage(listOf(pending), "cursor") }
        val state = ReservationState(gateway, AppRole.Parent)
        state.reload()
        val reply = CompletableDeferred<ReservationPage>()
        gateway.read = { before -> if (before != null) withContext(NonCancellable) { reply.await() } else ReservationPage(emptyList(), null) }
        val job = launch(start = CoroutineStart.UNDISPATCHED) { state.more() }
        state.reload()
        reply.complete(ReservationPage(listOf(pending), null))
        job.join()
        assertTrue(state.items.isEmpty())
        assertFalse(state.hasMore || state.loadingMore)
    }

    @Test fun repeatedCursorFailsWithoutAppendingRows() = runBlocking {
        val gateway = gateway()
        gateway.read = { ReservationPage(listOf(pending), "cursor") }
        val state = ReservationState(gateway, AppRole.Parent)
        state.reload()
        state.more()
        assertEquals(listOf(pending), state.items)
        assertNotNull(state.error)
        assertFalse(state.loadingMore)
    }
}
